---
mindmap-plugin: basic
---

# 9. Virtual Memory

## 9.1 Overview
- Separate logical and physical memory
- Allows larger virtual memory than physical memory
- Benefits:
  - Partial loading
  - Increased concurrency
  - Reduced I/O
  - Memory sharing

## 9.2 Virtual Address Space
- Sparse layout with holes
- Shared libraries
- Shared memory
- Pages shared on fork()

## 9.3 Demand Paging
- Pages loaded on access (page fault)
- Lazy Swapper = only load when needed
- Page Fault Handling:
  - Check validity
  - Allocate free frame
  - Read from disk
  - Update page table
  - Restart instruction

## 9.4 Copy-on-Write (COW)
- Pages shared between parent/child after fork()
- On write: copy page
- Pages initialized from zero-fill-on-demand pool

## 9.5 Page Replacement
- Used when no free frames
- Dirty Bit optimization:
  - Only modified pages are written to disk
- Algorithms:
  - FIFO (may cause Belady’s Anomaly)
  - OPT (optimal but unrealistic)
  - LRU (practical and effective)

## 9.6 Effective Access Time (EAT)
- Formula:
  - EAT = (1 - p) × mem_access + p × page_fault_time
- Page fault rate `p` critical to performance

## 9.7 Thrashing
- High page fault rate → CPU stuck swapping
- Cause: insufficient frames for working set
- Mitigation:
  - Limit degree of multiprogramming
  - Use working set model