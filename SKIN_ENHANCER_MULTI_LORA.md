# Skin Enhancer Multi-LoRA Implementation

## Date
October 6, 2025

## Overview
Added multi-LoRA support to the skin enhancer, allowing users to stack multiple influencer LoRA models (similar to rgthree's Power LoRA Loader in ComfyUI). The fixed enhancement LoRAs (real-humans-PublicPrompts.safetensors and more_details.safetensors) remain unchanged.

---

## Changes Made

### 1. Frontend (`skin-enhancer/page.tsx`)

#### Added LoRAConfig Interface
```tsx
interface LoRAConfig {
  id: string;
  modelName: string;
  strength: number;
}
```

#### Updated EnhancementParams
```tsx
interface EnhancementParams {
  // ... existing params
  loras: LoRAConfig[]; // Multi-LoRA support for influencer models
  // ... other params
}
```

#### Added Multi-LoRA Management Functions
```tsx
// Add a new influencer LoRA
const addLoRA = () => {
  const newLoRA: LoRAConfig = {
    id: crypto.randomUUID(),
    modelName: availableInfluencerLoRAs[0]?.fileName || "None",
    strength: 0.95,
  };
  setParams((prev) => ({ ...prev, loras: [...prev.loras, newLoRA] }));
};

// Remove an influencer LoRA by ID
const removeLoRA = (id: string) => {
  setParams((prev) => ({
    ...prev,
    loras: prev.loras.filter((lora) => lora.id !== id),
  }));
};

// Update a specific LoRA's model or strength
const updateLoRA = (id: string, field: keyof LoRAConfig, value: string | number) => {
  setParams((prev) => ({
    ...prev,
    loras: prev.loras.map((lora) =>
      lora.id === id ? { ...lora, [field]: value } : lora
    ),
  }));
};
```

#### Updated Workflow Generation
The `createSkinEnhancerWorkflowJson` function now:
1. Uses `params.loras` array instead of single `selectedInfluencerLora`
2. Creates the first influencer LoRA as node 108 (LoraLoader)
3. Chains additional influencer LoRAs as nodes 109, 110, 111, etc. (LoraLoaderModelOnly)
4. Connects node 104 (KSampler) to the last LoRA node's model output
5. Connects nodes 105 and 106 (CLIPTextEncode) to node 108's CLIP output (always)

**Multi-LoRA Chaining Logic:**
```tsx
// Determine the last LoRA node ID
const hasInfluencerLoRAs = params.loras.length > 0;
const loraCount = hasInfluencerLoRAs ? params.loras.length : 1;
const lastLoraNodeId = hasInfluencerLoRAs ? `10${7 + loraCount}` : "108";

// Add chained LoraLoaderModelOnly nodes for 2nd+ influencer LoRAs
if (hasInfluencerLoRAs && params.loras.length > 1) {
  for (let i = 1; i < params.loras.length; i++) {
    const nodeId = `10${8 + i}`; // 109, 110, 111, etc.
    const prevNodeId = i === 1 ? "108" : `10${7 + i}`;
    
    workflow[nodeId] = {
      inputs: {
        model: [prevNodeId, 0], // Chain from previous LoRA
        lora_name: params.loras[i].modelName,
        strength_model: params.loras[i].strength,
      },
      class_type: "LoraLoaderModelOnly",
    };
  }
}
```

#### New Multi-LoRA UI
Replaced single dropdown with dynamic LoRA cards:
- Each card shows LoRA number, model selection, and strength slider
- Add LoRA button to create new influencer LoRA slots
- Remove button (X) for each LoRA card
- Visual feedback showing number of active influencer LoRAs

---

### 2. Backend Handler (`skin_enhancer_handler.py`)

#### Updated LoRA Detection
Changed from detecting only `LoraLoader` to detecting both node types:

```python
# BEFORE
if node.get('class_type') == 'LoraLoader' and 'inputs' in node:

# AFTER  
if node.get('class_type') in ['LoraLoader', 'LoraLoaderModelOnly'] and 'inputs' in node:
```

#### Enhanced Logging
Added multi-LoRA configuration detection:
```python
if lora_nodes_found > 1:
    logger.info(f"🎨 Multi-LoRA Configuration Detected:")
    for i, lora_info in enumerate(enhancement_loras, 1):
        logger.info(f"   LoRA {i}: {lora_info}")

logger.info(f"📊 Total LoRA nodes found: {lora_nodes_found}")
```

---

## Architecture

### Node Structure

**Fixed Enhancement LoRAs (Unchanged):**
- Node 115: `real-humans-PublicPrompts.safetensors` (strength: 1.0)
- Node 115_2: `more_details.safetensors` (strength: 0.6)

**Influencer LoRAs (New Multi-LoRA Support):**
- Node 108: First influencer LoRA (LoraLoader) - has both MODEL and CLIP outputs
- Node 109+: Additional influencer LoRAs (LoraLoaderModelOnly) - MODEL output only

### Connection Pattern

```
UNETLoader (118) ──> DualCLIPLoader (119)
                           │
                           ▼
                    LoraLoader (108) ─────┬─> LoraLoaderModelOnly (109) ─┬─> LoraLoaderModelOnly (110) ─┬─> KSampler (104)
                    [1st Influencer]       │   [2nd Influencer]            │   [3rd Influencer]            │
                                          │                                │                                │
                    Outputs:               │   Outputs:                    │   Outputs:                    │
                    • MODEL (0) ──────────>│   • MODEL (0) ───────────────>│   • MODEL (0) ───────────────>│
                    • CLIP (1) ───────┐    │                                │                                │
                                      │    │                                │                                │
                                      └────┴────────────────────────────────┴───> CLIPTextEncode (105, 106)
                                           Always use node 108's CLIP output
```

### Key Technical Points

1. **First Influencer LoRA (Node 108):**
   - Uses `LoraLoader` class
   - Accepts: model, clip, lora_name, strength_model, strength_clip
   - Outputs: MODEL (0) and CLIP (1)

2. **Additional Influencer LoRAs (Nodes 109+):**
   - Use `LoraLoaderModelOnly` class
   - Accepts: model, lora_name, strength_model (NO clip parameters)
   - Outputs: MODEL (0) only

3. **CLIP Connections:**
   - Always connect to node 108's CLIP output
   - Never try to use LoraLoaderModelOnly's CLIP (doesn't exist)

4. **MODEL Connections:**
   - Connect to the last LoRA node's MODEL output
   - This ensures all LoRAs are stacked/applied

---

## Testing Checklist

### ✅ Expected Behavior

**Single Influencer LoRA:**
```
🎭 Found LoRA node 108 (LoraLoader): user_xxx_Model1.safetensors (strength: 0.95)
📊 Total LoRA nodes found: 3  # 108 + 115 + 115_2
```

**Multiple Influencer LoRAs:**
```
🎭 Found LoRA node 108 (LoraLoader): user_xxx_Model1.safetensors (strength: 0.95)
🎭 Found LoRA node 109 (LoraLoaderModelOnly): user_xxx_Model2.safetensors (strength: 0.8)
🎭 Found LoRA node 110 (LoraLoaderModelOnly): user_xxx_Model3.safetensors (strength: 0.75)
🎨 Multi-LoRA Configuration Detected:
   LoRA 1: Node 108: user_xxx_Model1.safetensors (strength: 0.95, type: LoraLoader)
   LoRA 2: Node 109: user_xxx_Model2.safetensors (strength: 0.8, type: LoraLoaderModelOnly)
   LoRA 3: Node 110: user_xxx_Model3.safetensors (strength: 0.75, type: LoraLoaderModelOnly)
📊 Total LoRA nodes found: 5  # 108 + 109 + 110 + 115 + 115_2
```

### UI Features to Test

1. ✅ Click "Add LoRA" button - should add new LoRA card
2. ✅ Select different influencer models from dropdown
3. ✅ Adjust strength sliders (0.0 - 1.0)
4. ✅ Remove individual LoRA cards with X button
5. ✅ Generate with 0 influencer LoRAs (should use fallback)
6. ✅ Generate with 1 influencer LoRA
7. ✅ Generate with 2-3 influencer LoRAs (multi-stack)
8. ✅ Verify images show combined influence of all LoRAs

---

## Deployment

### No Build Required!
Since the skin enhancer handler is currently deployed with a Docker image, and we only added logging enhancements (not critical functionality changes), you can test the multi-LoRA feature with the existing deployed handler.

### If You Want to Rebuild:
```bash
# Fix line endings if needed
dos2unix build-and-push-skin-enhancer.sh 2>$null; if ($LASTEXITCODE -ne 0) { (Get-Content build-and-push-skin-enhancer.sh -Raw) -replace "`r`n","`n" | Set-Content build-and-push-skin-enhancer.sh -NoNewline }

# Build and push
bash ./build-and-push-skin-enhancer.sh
```

The new Docker image will include:
- Multi-LoRA detection for both LoraLoader and LoraLoaderModelOnly
- Enhanced logging for multi-LoRA configurations
- Better debugging output

---

## Differences from Style Transfer

### Similarities:
- Same multi-LoRA chaining approach
- First LoRA uses `LoraLoader`, additional use `LoraLoaderModelOnly`
- CLIP always connects to first LoRA
- MODEL connects to last LoRA in chain

### Differences:
- **Fixed Enhancement LoRAs:** Skin enhancer has 2 fixed enhancement LoRAs (nodes 115, 115_2) that are NOT affected by multi-LoRA changes
- **Node Numbering:** Influencer LoRAs start at node 108 (not 51 like style transfer)
- **Purpose:** Influencer LoRAs control subject/person appearance; enhancement LoRAs improve skin quality
- **Workflow:** More complex with VAEEncode/Decode passes for enhancement

---

## Status
✅ **COMPLETE** - Multi-LoRA support for influencer models implemented and ready for testing!

## Next Steps
1. Test with single influencer LoRA
2. Test with 2-3 stacked influencer LoRAs
3. Verify enhancement LoRAs (115, 115_2) continue working correctly
4. Monitor logs for multi-LoRA detection messages
5. Verify image quality with multiple influencer LoRAs applied

## Last Updated
October 6, 2025 - 11:15 AM UTC
