# Local DB Platform Notes

This project does not commit or distribute platform records extracted from an installed MNW database.

For a local developer inspection, write both outputs beneath the ignored `generated/` directory:

`python .\tools\inspect-local-db.py --category submarines --pattern Virginia --write-json .\generated\db\virginia-platforms.json --write-markdown .\generated\db\local-db-platform-notes.md`

The desktop app performs its own targeted runtime index and caches the normalized result at `generated/db/platform-catalog.json`. That cache is invalidated when the selected `.core` archive name, size, or modification time changes.
