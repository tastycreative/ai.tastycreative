# Multi-LoRA CLIP Connection Fix

## Date
October 6, 2025

## Problem 1: CLIP Connection Errors
After fixing the handler to properly resolve LoRA paths for both `LoraLoader` and `LoraLoaderModelOnly` nodes, the workflow failed validation with:

```
* CLIPTextEncode 33: - Exception when validating inner node: tuple index out of range
* CLIPTextEncode 6: - Exception when validating inner node: tuple index out of range
```

## Problem 2: Unexpected Keyword Argument
After fixing the CLIP connections, execution failed with:

```
TypeError: LoraLoaderModelOnly.load_lora_model_only() got an unexpected keyword argument 'clip'
```

## Root Causes

### Issue 1: Invalid CLIP Output Reference
The workflow generation code was incorrectly trying to connect CLIPTextEncode nodes (6 and 33) to the **last LoRA node's CLIP output**:

```tsx
// WRONG - for multi-LoRA
clip: [lastLoraNodeId, 1]  // lastLoraNodeId could be "52", "53", etc.
```

**The Issue**: `LoraLoaderModelOnly` nodes (used for 2nd+ LoRAs) **don't have a CLIP output** - they only pass through the MODEL. Only the first `LoraLoader` node has both MODEL and CLIP outputs.

### Issue 2: Invalid Input Parameters
The workflow was passing `clip` and `strength_clip` inputs to `LoraLoaderModelOnly` nodes:

```tsx
// WRONG
workflow[nodeId] = {
  inputs: {
    model: [prevNodeId, 0],
    clip: [prevNodeId, 1],      // ❌ LoraLoaderModelOnly doesn't accept this
    strength_clip: 1,            // ❌ LoraLoaderModelOnly doesn't accept this
  },
  class_type: "LoraLoaderModelOnly",
};
```

**The Issue**: `LoraLoaderModelOnly` only accepts `model`, `lora_name`, and `strength_model` parameters. It does NOT accept `clip` or `strength_clip`.

## Node Output Types
- **LoraLoader** (node 51 - first LoRA):
  - Output 0: MODEL ✅
  - Output 1: CLIP ✅
  
- **LoraLoaderModelOnly** (nodes 52, 53, etc. - additional LoRAs):
  - Output 0: MODEL ✅
  - Output 1: ❌ DOES NOT EXIST

## Solution

### Fix 1: Correct CLIP Connections
Changed the CLIP connections for CLIPTextEncode nodes to **always** connect to node 51 (first LoRA):

**Node 6 (Positive Prompt):**
```tsx
// BEFORE
"6": {
  inputs: {
    text: params.prompt,
    clip: [lastLoraNodeId, 1], // ❌ Wrong for multi-LoRA
  },
  class_type: "CLIPTextEncode",
}

// AFTER
"6": {
  inputs: {
    text: params.prompt,
    clip: ["51", 1], // ✅ Always use first LoRA's CLIP
  },
  class_type: "CLIPTextEncode",
}
```

**Node 33 (Negative Prompt):**
```tsx
// BEFORE
"33": {
  inputs: {
    text: "",
    clip: [lastLoraNodeId, 1], // ❌ Wrong for multi-LoRA
  },
  class_type: "CLIPTextEncode",
}

// AFTER
"33": {
  inputs: {
    text: "",
    clip: ["51", 1], // ✅ Always use first LoRA's CLIP
  },
  class_type: "CLIPTextEncode",
}
```

### Fix 2: Remove Invalid Parameters from LoraLoaderModelOnly
Removed `clip` and `strength_clip` inputs from `LoraLoaderModelOnly` nodes:

```tsx
// BEFORE
workflow[nodeId] = {
  inputs: {
    model: [prevNodeId, 0],
    clip: [prevNodeId, 1],      // ❌ Invalid parameter
    lora_name: params.loras[i].modelName,
    strength_model: params.loras[i].strength,
    strength_clip: 1,            // ❌ Invalid parameter
  },
  class_type: "LoraLoaderModelOnly",
};

// AFTER
workflow[nodeId] = {
  inputs: {
    model: [prevNodeId, 0],     // ✅ Only valid parameter
    lora_name: params.loras[i].modelName,
    strength_model: params.loras[i].strength,
    // Note: LoraLoaderModelOnly does NOT accept 'clip' or 'strength_clip' parameters
  },
  class_type: "LoraLoaderModelOnly",
};
```

**Node 31 (KSampler) - NO CHANGE NEEDED:**
```tsx
"31": {
  inputs: {
    model: [lastLoraNodeId, 0], // ✅ Correct - use last LoRA's model output
    // ... other inputs
  },
  class_type: "KSampler",
}
```

## Correct Multi-LoRA Connection Pattern

### Single LoRA (existing behavior):
```
DualCLIPLoader (38) ──┬─> LoraLoader (51) ─┬─> KSampler (31) [model]
                      └─> CLIPTextEncode (6, 33) [clip]
```

### Multi-LoRA (fixed behavior):
```
DualCLIPLoader (38) ──┬─> LoraLoader (51) ─┬──> LoraLoaderModelOnly (52) ─┬─> LoraLoaderModelOnly (53) ─┬─> KSampler (31) [model]
                      │                     │                              │                              │
                      │                     └─ MODEL only                  └─ MODEL only                  └─ MODEL only
                      │
                      └─> CLIPTextEncode (6, 33) [clip] ✅ Always from node 51
```

## Key Takeaways
1. **CLIP connections**: Always use node 51 (first LoRA with LoraLoader) - it's the only node with CLIP output
2. **MODEL connections**: Use lastLoraNodeId to get the final model after all LoRAs are applied
3. **LoraLoaderModelOnly inputs**: Only accepts `model`, `lora_name`, and `strength_model` (NO `clip` or `strength_clip`)
4. **LoraLoader inputs**: Accepts `model`, `clip`, `lora_name`, `strength_model`, and `strength_clip`

## ComfyUI Node Specifications

### LoraLoader (node 51 - first LoRA)
**Inputs:**
- `model`: MODEL input
- `clip`: CLIP input
- `lora_name`: string (LoRA filename)
- `strength_model`: float (model strength)
- `strength_clip`: float (CLIP strength)

**Outputs:**
- Output 0: MODEL ✅
- Output 1: CLIP ✅

### LoraLoaderModelOnly (nodes 52, 53, etc. - additional LoRAs)
**Inputs:**
- `model`: MODEL input (ONLY)
- `lora_name`: string (LoRA filename)
- `strength_model`: float (model strength)

**Outputs:**
- Output 0: MODEL ✅
- Output 1: ❌ DOES NOT EXIST

## Files Modified
- `app/(dashboard)/workspace/generate-content/style-transfer/page.tsx`
  - Line ~1599: Node 33 CLIP connection fixed (use node 51)
  - Line ~1700: Node 6 CLIP connection fixed (use node 51)
  - Line ~1719: Removed invalid `clip` and `strength_clip` parameters from LoraLoaderModelOnly nodes

## Testing
After this fix, multi-LoRA workflows should properly validate and execute with:
- Node 6 and 33 using node 51's CLIP output
- Node 31 using the last LoRA node's MODEL output
- All LoRA paths correctly resolved by the handler

## Status
✅ **FIXED** - Ready for testing with multi-LoRA style transfer
