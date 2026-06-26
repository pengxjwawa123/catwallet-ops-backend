# Bug Report: `i18n/config/batch/add` returns HTTP 500 on any non-empty file

**To:** CatWallet API team
**From:** Ops backend (admin.catwallet.ai i18n management)
**Date:** 2026-06-26
**Severity:** High — i18n batch import is fully unusable in production
**Endpoint:** `POST /gt/wallet/api/i18n/config/batch/add`

---

## Summary

The batch-import endpoint `POST /gt/wallet/api/i18n/config/batch/add` throws an
unhandled **HTTP 500** for **any non-empty uploaded file**. It only returns 200
when the uploaded `file` part is empty (importing 0 rows). This makes the i18n
batch import feature unusable.

Our ops backend forwards the admin user's uploaded spreadsheet to this endpoint
unchanged. When it receives the 500 we surface a 502 to the admin UI. We have
confirmed the failure originates entirely at the upstream endpoint, not in our
forwarding layer.

## Production evidence

Our backend logs the upstream response body verbatim:

```
context: I18nService
msg: "batch import failed: 500 Internal Server Error - upstream body: {\"code\":\"1000\",\"message\":\"internal server error\"}"
```

Upstream returns:

```json
{ "code": "1000", "message": "internal server error" }
```

## Reproduction (direct against the API, no proxy involved)

Verified against `https://dev.api.catwallet.ai`. Field name is `file`,
multipart/form-data, no auth header required.

| # | Uploaded `file` part | HTTP status | Body |
|---|---|---|---|
| 1 | (no `file` part at all) | **500** | `{"code":"1000","message":"internal server error"}` |
| 2 | **empty** file (0 bytes) | **200** | `{"code":"200","msg":"success","data":0}` |
| 3 | arbitrary non-empty bytes | **500** | `{"code":"1000","message":"internal server error"}` |
| 4 | **valid xlsx**, columns `configKey, zh, en` (1 data row) | **500** | `{"code":"1000","message":"internal server error"}` |
| 5 | **valid xlsx**, columns `platformSource, configKey, lang, value` | **500** | `{"code":"1000","message":"internal server error"}` |
| 6 | valid xlsx, header row only, 0 data rows | **500** | `{"code":"1000","message":"internal server error"}` |
| 7 | valid xlsx + extra form fields `platformSource=APP`, `lang=zh` | **500** | `{"code":"1000","message":"internal server error"}` |

Control: `POST /gt/wallet/api/i18n/config/list` returns **200** with full data,
so the base URL, routing, and (lack of) auth are all fine.

### Repro commands

```bash
# Case 2 — empty file → 200 (imports 0 rows)
printf '' > empty.xlsx
curl -i -X POST 'https://dev.api.catwallet.ai/gt/wallet/api/i18n/config/batch/add' \
  -H 'Accept: application/json' \
  -F 'file=@empty.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

# Case 4 — valid xlsx with one data row → 500
python3 -c "import openpyxl; wb=openpyxl.Workbook(); ws=wb.active; \
ws.append(['configKey','zh','en']); ws.append(['probe_key','测试','test']); wb.save('layoutA.xlsx')"
curl -i -X POST 'https://dev.api.catwallet.ai/gt/wallet/api/i18n/config/batch/add' \
  -H 'Accept: application/json' \
  -F 'file=@layoutA.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
```

## Analysis

- Empty file = no rows to parse = the parser is never invoked = 200.
- Any content = the parser runs and throws an **unhandled exception** = generic
  500 / `code 1000`.
- The crash is independent of column layout, extra form fields, or whether the
  file is a "real" xlsx — every non-empty body fails identically.

This strongly indicates a server-side defect in the spreadsheet-parsing path of
`batch/add` (missing try/catch and/or a parser that does not tolerate the input
it is being given).

## What we need from you

1. **Fix** the unhandled 500 in `batch/add` so it processes a valid spreadsheet.
2. **The canonical import template / column spec** the endpoint expects. We could
   not retrieve it ourselves: `i18n/config/export` and
   `i18n/config/batch/template` both return
   `{"code":"1001","message":"missing or invalid request timestamp"}` (they
   appear to require the legacy timestamp/signature auth scheme, which the
   current i18n CRUD endpoints no longer use).
3. Confirmation of whether `platformSource` / `lang` should be **columns in the
   sheet** or **separate form fields**.

## Our side (for reference)

- We forward the uploaded file unchanged as multipart field `file` via Node's
  `fetch` + `FormData` + `Blob`. We verified this is byte-for-byte equivalent to
  `curl -F` (both produce the same 200/500 results above), so the issue is not in
  our forwarding.
- No changes required on our end once the endpoint is fixed.
