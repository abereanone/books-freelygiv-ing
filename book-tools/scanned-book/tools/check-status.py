"""Status of the page-by-page scan check.
Batches: b1 = scan pages 11-57, b2 = 58-104, b3 = 105-151, b4 = 152-198.
A page is done when check/results/nN.tsv exists. A batch is "active" if its claim file
(check/claims/bK) was touched in the last 30 minutes. Prints one line per batch and a summary.
Usage: python -I tools/check-status.py
"""
import os, time

BATCHES = {'b1': range(11, 58), 'b2': range(58, 105), 'b3': range(105, 152), 'b4': range(152, 199)}
now = time.time()
todo_total = 0
for b, pages in BATCHES.items():
    todo = [n for n in pages if not os.path.exists(f'check/results/n{n}.tsv')]
    todo_total += len(todo)
    claim = f'check/claims/{b}'
    age = (now - os.path.getmtime(claim)) / 60 if os.path.exists(claim) else None
    if not todo:
        state = 'complete'
    elif age is not None and age < 30:
        state = f'active (claim touched {age:.0f} min ago)'
    else:
        state = 'needs a helper'
    print(f'{b}: {len(pages) - len(todo)}/{len(pages)} pages done; {state}' + (f'; next page n{todo[0]}' if todo else ''))
print('ALL DONE' if todo_total == 0 else f'{todo_total} pages left')
