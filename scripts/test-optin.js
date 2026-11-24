var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var FORM_PAGES = [
  { rel: 'index.html', forms: 2 },
  { rel: 'grocery/index.html', forms: 1 },
  { rel: 'joint-genesis-review/index.html', forms: 1 },
  { rel: 'joint-genesis-ingredients/index.html', forms: 1 }
];
var OTHER_PAGES = ['about.html', 'disclosure.html', 'privacy.html'];
var NAME_ERROR = 'Please enter your first name.';
var EMAIL_ERROR = 'Please enter a valid email address, like name@example.com.';
var VALID_EMAIL = 'name@example.com';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function formBlocks(html) {
  return html.match(/<form class="optin-form"[\s\S]*?<\/form>/g) || [];
}

function optinScript(html) {
  var scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  var found = scripts.filter(function (block) {
    return block.indexOf("input[name=FIRSTNAME]") !== -1;
  });
  assert.equal(found.length, 1);
  return found[0].replace(/^<script>\n?/, '').replace(/\n?<\/script>$/, '');
}

function field(name, describedBy) {
  return {
    name: name,
    value: '',
    attributes: { 'aria-describedby': describedBy },
    setAttribute: function (key, value) { this.attributes[key] = String(value); },
    removeAttribute: function (key) { delete this.attributes[key]; },
    getAttribute: function (key) {
      return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
    },
    focus: function () { this.ownerDocument.active = this; }
  };
}

function loadPage(script, formCount) {
  var forms = [];
  var byId = {};
  var doc = {
    active: null,
    querySelectorAll: function (selector) {
      if (selector === '.optin-form') return forms;
      return [];
    },
    getElementById: function (id) { return byId[id] || null; }
  };
  var timers = [];

  for (var i = 0; i < formCount; i++) {
    var suffix = i === 0 ? '' : '-b';
    var fnErrId = 'err-fn' + suffix;
    var emErrId = (suffix === '' ? 'err' : 'err' + suffix);
    var fn = field('FIRSTNAME', fnErrId);
    var em = field('EMAIL', emErrId);
    fn.ownerDocument = doc;
    em.ownerDocument = doc;
    var fnErr = { id: fnErrId, hidden: true, text: NAME_ERROR };
    var emErr = { id: emErrId, hidden: true, text: EMAIL_ERROR };
    byId[fnErrId] = fnErr;
    byId[emErrId] = emErr;
    var thanks = {
      hidden: true,
      focus: function () { doc.active = this; }
    };
    forms.push({
      hidden: false,
      nextElementSibling: thanks,
      listeners: {},
      fn: fn,
      em: em,
      fnErr: fnErr,
      emErr: emErr,
      thanks: thanks,
      addEventListener: function (type, handler) { this.listeners[type] = handler; },
      querySelector: function (selector) {
        if (selector === 'input[name=FIRSTNAME]') return this.fn;
        if (selector === 'input[name=EMAIL]') return this.em;
        return null;
      }
    });
  }

  vm.runInNewContext(script, {
    document: doc,
    setTimeout: function (fn, ms) { timers.push({ fn: fn, ms: ms }); }
  });

  forms.forEach(function (form) {
    assert.equal(typeof form.listeners.submit, 'function');
  });

  return { forms: forms, timers: timers, doc: doc };
}

function submit(page, index) {
  var prevented = false;
  var submitted = false;
  page.forms[index].listeners.submit({
    preventDefault: function () { prevented = true; },
    // A real submit would POST to Brevo. This stand-in must never run on success.
    submitToBrevo: function () { submitted = true; }
  });
  assert.equal(submitted, false);
  return prevented;
}

test('every signup form requires a first name and keeps the Brevo field names', function () {
  var scripts = [];
  FORM_PAGES.forEach(function (page) {
    var html = read(page.rel);
    var forms = formBlocks(html);
    assert.equal(forms.length, page.forms, page.rel);
    assert.equal(html.indexOf('(optional)'), -1, page.rel);
    assert.equal(html.indexOf('class="opt"'), -1, page.rel);
    assert.equal((html.match(/name="FIRSTNAME"/g) || []).length, page.forms, page.rel);
    assert.equal((html.match(/name="EMAIL"/g) || []).length, page.forms, page.rel);
    assert.equal((html.match(/data-clarity-mask="true"/g) || []).length, page.forms, page.rel);

    forms.forEach(function (form) {
      assert.match(form, /action="https:\/\/8d3f0c81\.sibforms\.com\/serve\//);
      assert.match(form, /\smethod="POST"/);
      assert.match(form, /\starget="brevo_frame"/);
      assert.match(form, /\snovalidate\b/);
      assert.match(form, /\sdata-clarity-mask="true"/);
      assert.match(form, /name="email_address_check"/);
      assert.match(form, /name="UTM_SOURCE"/);
      assert.match(form, /name="UTM_MEDIUM"/);
      assert.match(form, /name="UTM_CONTENT"/);

      var input = form.match(/<input\b[^>]*\bname="FIRSTNAME"[^>]*>/);
      assert.ok(input, page.rel);
      assert.match(input[0], /\btype="text"/);
      assert.match(input[0], /\bautocomplete="given-name"/);
      assert.match(input[0], /\bmaxlength="60"/);
      assert.match(input[0], /(?:\s)required(?:[\s>])/);
      var described = input[0].match(/\baria-describedby="([^"]+)"/);
      assert.ok(described, page.rel);
      var forId = input[0].match(/\bid="([^"]+)"/)[1];
      assert.match(form, new RegExp('<label for="' + forId + '">First name</label>'));
      assert.match(form, new RegExp(
        '<p id="' + described[1] + '" class="optin-err" role="alert" hidden>' + NAME_ERROR + '</p>'
      ));
      assert.match(form, new RegExp(
        '<p id="err(?:-b)?" class="optin-err" role="alert" hidden>' + EMAIL_ERROR.replace(/[.]/g, '\\.') + '</p>'
      ));
    });

    var script = optinScript(html);
    assert.ok(script.indexOf('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/') !== -1, page.rel);
    assert.equal(script.indexOf('sibforms.com'), -1);
    assert.equal(script.indexOf('clickbank'), -1);
    assert.equal(script.indexOf('fetch('), -1);
    scripts.push(script);
  });

  scripts.forEach(function (script) {
    assert.equal(script, scripts[0]);
  });

  OTHER_PAGES.forEach(function (rel) {
    var html = read(rel);
    assert.equal(formBlocks(html).length, 0, rel);
    assert.equal(html.indexOf('name="FIRSTNAME"'), -1, rel);
  });
});

test('an empty or whitespace-only first name is rejected in the email error style', function () {
  var script = optinScript(read('index.html'));
  ['', ' ', '\t', '\n', ' \t \n ', '\u00a0'].forEach(function (name) {
    var page = loadPage(script, 2);
    page.forms[0].fn.value = name;
    page.forms[0].em.value = '  ' + VALID_EMAIL + '  ';
    var prevented = submit(page, 0);
    assert.equal(prevented, true, JSON.stringify(name));
    assert.equal(page.forms[0].fnErr.hidden, false);
    assert.equal(page.forms[0].fnErr.text, NAME_ERROR);
    assert.equal(page.forms[0].emErr.hidden, true);
    assert.equal(page.forms[0].fn.attributes['aria-invalid'], 'true');
    assert.equal(page.forms[0].em.attributes['aria-invalid'], undefined);
    assert.equal(page.doc.active, page.forms[0].fn);
    assert.equal(page.forms[0].fn.value, name);
    assert.equal(page.forms[0].hidden, false);
    assert.equal(page.forms[0].thanks.hidden, true);
    assert.equal(page.timers.length, 0);
    assert.equal(page.forms[1].hidden, false);
  });
});

test('a valid first name clears its error and still checks the email address', function () {
  var script = optinScript(read('grocery/index.html'));
  var page = loadPage(script, 1);
  page.forms[0].fn.value = '   ';
  page.forms[0].em.value = VALID_EMAIL;
  assert.equal(submit(page, 0), true);
  assert.equal(page.forms[0].fnErr.hidden, false);

  page.forms[0].fn.value = '  Pat  ';
  page.forms[0].em.value = 'not-an-email';
  assert.equal(submit(page, 0), true);
  assert.equal(page.forms[0].fnErr.hidden, true);
  assert.equal(page.forms[0].emErr.hidden, false);
  assert.equal(page.forms[0].emErr.text, EMAIL_ERROR);
  assert.equal(page.forms[0].fn.attributes['aria-invalid'], undefined);
  assert.equal(page.forms[0].em.attributes['aria-invalid'], 'true');
  assert.equal(page.doc.active, page.forms[0].em);
  assert.equal(page.forms[0].fn.value, '  Pat  ');
  assert.equal(page.timers.length, 0);

  page.forms[0].fn.value = '  Mary Ann  ';
  page.forms[0].em.value = '  ' + VALID_EMAIL + '\t';
  assert.equal(submit(page, 0), false);
  assert.equal(page.forms[0].fn.value, 'Mary Ann');
  assert.equal(page.forms[0].em.value, VALID_EMAIL);
  assert.equal(page.forms[0].fnErr.hidden, true);
  assert.equal(page.forms[0].emErr.hidden, true);
  assert.equal(page.timers.length, 1);
  assert.equal(page.timers[0].ms, 300);
  page.timers[0].fn();
  assert.equal(page.forms[0].hidden, true);
  assert.equal(page.forms[0].thanks.hidden, false);
  assert.equal(page.doc.active, page.forms[0].thanks);
});

test('a valid signup on the bridge page still reveals every thank-you panel', function () {
  var script = optinScript(read('joint-genesis-review/index.html'));
  assert.equal(script, optinScript(read('joint-genesis-ingredients/index.html')));
  var page = loadPage(optinScript(read('index.html')), 2);
  page.forms[1].fn.value = "O'Neil";
  page.forms[1].em.value = VALID_EMAIL;
  assert.equal(submit(page, 1), false);
  assert.equal(page.forms[1].fn.value, "O'Neil");
  page.timers[0].fn();
  page.forms.forEach(function (form) {
    assert.equal(form.hidden, true);
    assert.equal(form.thanks.hidden, false);
  });
  assert.equal(page.doc.active, page.forms[1].thanks);
});
