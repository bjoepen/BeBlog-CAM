# 001Z-F — Tool Assignment Guard

`Werkzeuge` uses the same central `validateToolCompatibility()` rule as `Prüfen`.

For the selected target operation the tool page now shows the tool currently
assigned to that operation and PASS / WARN / FAIL for the tool currently loaded
in the calculator.

Transfer:
- PASS: allowed
- WARN: allowed with warning
- FAIL: blocked

Transferred values are tool identity/type, effective diameter, calculated
spindle speed and calculated XY feed.

Plunge feed, stepdown, Safe Z and strategy parameters remain operation-owned.
