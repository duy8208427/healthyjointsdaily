# Team Tracking Implementation Summary

**Date**: November 2, 2026  
**Repository**: duy8208427/healthyjointsdaily  
**Status**: ✅ Deployed to Production

---

## Overview

Implemented team tracking functionality to separate test clicks from real user clicks in ClickBank reports. The team can now visit `/s/teamtest` to enable a persistent tracking mode that tags all clicks and form submissions with test identifiers.

---

## Changes Made

### 1. Tracking Script Updates (4 pages)

Updated the first-touch UTM tracking script on all pages with ClickBank links:
- `index.html`
- `grocery/index.html`
- `joint-genesis-review/index.html`
- `joint-genesis-ingredients/index.html`

**New functionality:**
- Added `hjd_team` localStorage flag for persistent team mode
- `?tid=teamtest` URL parameter sets team mode
- `?hjdteam=off` URL parameter clears team mode
- When team mode is active:
  - All ClickBank hop links get `tid=teamtest` (overrides everything)
  - Brevo form UTM inputs: `UTM_SOURCE=team`, `UTM_MEDIUM=test`, `UTM_CONTENT=teamtest`
  - Persists across page navigation via localStorage

### 2. Vercel Redirect Rules

Added two new redirect rules in `vercel.json` (placed before catch-all):
```json
{ "source": "/s/teamtest", "destination": "/?tid=teamtest&utm_source=team&utm_medium=test&utm_campaign=hjd_test&utm_content=teamtest", "permanent": false }
{ "source": "/s/teamoff", "destination": "/?hjdteam=off", "permanent": false }
```

All existing redirects remain unchanged.

---

## Testing Results

### Local Tests ✅ (All Pass)

**Redirect Validation (9/9 pass)**
- ✅ `/s/teamtest` → correct destination
- ✅ `/s/teamoff` → correct destination  
- ✅ All existing codes unchanged: pn261119b, pn261112a, yt261101z, em261123a, sr261120a, si261120a, unknown codes

**Playwright Tests (5/5 pass)**
- ✅ Fresh browser → tid=bridge (unchanged baseline)
- ✅ UTM parameters → tid from content (unchanged)
- ✅ Team mode persists across navigation
- ✅ Team mode overrides new UTM parameters
- ✅ Team mode can be disabled

### Production Tests ✅ (All Pass)

**Production URL**: https://healthyjointsdaily.vercel.app

**Redirect Validation (All verified)**
- ✅ `/s/teamtest` returns HTTP 307 to correct destination
- ✅ `/s/teamoff` returns HTTP 307 to correct destination
- ✅ All existing redirects working correctly
- ✅ Unknown codes fall through to homepage

**Playwright Production Tests (3/3 pass)**
- ✅ Team mode enabled: `tid=teamtest` and UTM fields = team/test/teamtest
- ✅ Team mode persists: After navigation, still returns `tid=teamtest`
- ✅ Team mode disabled: After visiting `/s/teamoff`, normal tracking resumes

**Manual Verification**
- ✅ `hjd_team` tracking logic present in live production HTML
- ✅ ClickBank links update dynamically with correct tid
- ✅ Form UTM fields populate correctly

---

## Deployment Details

| Item | Value |
|------|-------|
| **PR Number** | [#8](https://github.com/duy8208427/healthyjointsdaily/pull/8) |
| **PR URL** | https://github.com/duy8208427/healthyjointsdaily/pull/8 |
| **Merge SHA** | `3a14e1b203c310d942b81b67940e3b3e74266a5a` |
| **Pre-merge Tag** | `pre-teamtest-20261102` |
| **Tag Points To** | `4068a5c1696bd7f25f7dabd81b4238d2a6c7f89f` (origin/main before merge) |
| **Merged** | ✅ Yes |
| **Deployed** | ✅ Yes (Vercel auto-deploy) |

---

## Usage Instructions

### Enable Team Mode

**Method 1**: Short URL (recommended)
```
https://healthyjointsdaily.vercel.app/s/teamtest
```

**Method 2**: Direct parameter
```
https://healthyjointsdaily.vercel.app/?tid=teamtest
```

**What happens:**
1. Browser localStorage gets `hjd_team='1'`
2. All ClickBank hop links use `tid=teamtest`
3. All Brevo form sign-ups tagged as `team/test/teamtest`
4. **Persists across all page navigation** (stored in browser)

### Disable Team Mode

**Method 1**: Short URL (recommended)
```
https://healthyjointsdaily.vercel.app/s/teamoff
```

**Method 2**: Direct parameter
```
https://healthyjointsdaily.vercel.app/?hjdteam=off
```

**What happens:**
1. Browser localStorage `hjd_team` is removed
2. Returns to normal tracking behavior
3. First-touch UTM logic resumes

### Verify Team Mode Status

Open browser console and check:
```javascript
localStorage.getItem('hjd_team')  // Returns '1' if team mode is on, null if off
```

---

## Technical Details

### Priority Logic

When team mode is **active**:
```
Team mode overrides EVERYTHING
  → tid always = 'teamtest'
  → UTM fields always = team/test/teamtest
```

When team mode is **inactive** (normal behavior):
```
1. Current visit tid parameter (if present)
2. Current visit utm_content parameter (if present)
3. First-touch utm_content (from localStorage)
4. Fallback: 'bridge' + source abbreviation
```

### Implementation Notes

- **localStorage key**: `hjd_team` (value: `'1'` when active)
- **Trigger**: URL has `tid=teamtest` (case-insensitive after normalization)
- **Clear**: URL has `hjdteam=off` (exact match)
- **Script location**: Inline `<script>` before closing `</body>` on each page
- **Execution**: Runs on every page load, before any link clicks
- **Compatible with**: All existing first-touch UTM tracking logic

---

## Test Scripts

All test scripts are available in the repository:

1. **`test-vercel-redirects.js`** - Validates redirect rules (run with `npm run test:redirects`)
2. **`test-team-tracking.js`** - Local Playwright tests (run with `npm run test:tracking`)
3. **`test-production.js`** - Production validation tests (run with `node test-production.js`)

---

## Behavior Verification

### Scenario 1: Normal user (unchanged)
1. User visits via organic search: `/?utm_source=google&utm_content=organic123`
2. First-touch saved: `utm_content=organic123`
3. ClickBank links: `tid=organic123`
4. ✅ **Works as before**

### Scenario 2: Team member testing
1. Team visits: `/s/teamtest`
2. Team mode enabled, localStorage set
3. Navigate to `/grocery`, `/joint-genesis-review`, back to `/`
4. All ClickBank links: `tid=teamtest`
5. All form submissions: UTM = team/test/teamtest
6. ✅ **Test clicks separated from real data**

### Scenario 3: Team member with existing UTM data
1. User previously had `utm_content=pinterest123` saved
2. Team visits: `/s/teamtest`
3. ClickBank links now: `tid=teamtest` (overrides saved data)
4. Visit: `/?utm_source=youtube&utm_content=yt999999`
5. ClickBank links still: `tid=teamtest` (overrides new UTM)
6. ✅ **Team mode takes absolute priority**

### Scenario 4: Disable team mode
1. Team had team mode active
2. Team visits: `/s/teamoff`
3. Team mode cleared from localStorage
4. Visit: `/?utm_source=pinterest&utm_content=pn261119b`
5. ClickBank links: `tid=pn261119b`
6. ✅ **Normal tracking resumes**

---

## ClickBank Reporting

In ClickBank's jointgen affiliate reports, test hops will appear as:

- **TID**: `teamtest`
- **Source** (if captured): `team`
- **Medium** (if captured): `test`
- **Content** (if captured): `teamtest`

Real user hops will have their normal TID values (content codes, bridge+source, etc.).

---

## Notes

- ✅ No impact on real users (they never see team URLs)
- ✅ Backwards compatible (all existing logic preserved)
- ✅ No server-side changes required
- ✅ Works across all pages with tracking script
- ✅ Easy to enable/disable for entire team
- ✅ LocalStorage persists across browser sessions (until cleared)

---

## Support

For questions or issues:
- Check browser console for `hjd_team` localStorage value
- Test redirects: https://healthyjointsdaily.vercel.app/s/teamtest
- Review test scripts in repository
- Verify tracking script in production HTML source
