/**
 * Multi-LoRA Stack Usage Examples
 * 
 * This file demonstrates how to use the new multi-LoRA feature
 */

// Example 1: Single LoRA (Basic Usage)
// ========================================
const singleLoRAConfig = {
  prompt: "beautiful woman in a red dress",
  loras: [
    {
      id: "lora-1",
      modelName: "user_fashion_model.safetensors",
      strength: 0.95
    }
  ]
};

// Example 2: Double LoRA Stack (Style + Details)
// ===============================================
const doubleLoRAConfig = {
  prompt: "cyberpunk city at night with neon lights",
  loras: [
    {
      id: "lora-1",
      modelName: "user_cyberpunk_style.safetensors",
      strength: 0.90  // Strong cyberpunk style
    },
    {
      id: "lora-2",
      modelName: "user_neon_details.safetensors",
      strength: 0.70  // Medium neon details
    }
  ]
};

// Example 3: Triple LoRA Stack (Complex Composition)
// ===================================================
const tripleLoRAConfig = {
  prompt: "fashion model wearing avant-garde clothing in urban setting",
  loras: [
    {
      id: "lora-1",
      modelName: "user_base_model.safetensors",
      strength: 0.95  // Base character style
    },
    {
      id: "lora-2",
      modelName: "user_fashion_avant_garde.safetensors",
      strength: 0.80  // Fashion style overlay
    },
    {
      id: "lora-3",
      modelName: "user_urban_environment.safetensors",
      strength: 0.60  // Environmental details
    }
  ]
};

// Example 4: Subtle Blending (Low Strengths)
// ===========================================
const subtleBlendConfig = {
  prompt: "portrait photography, natural lighting",
  loras: [
    {
      id: "lora-1",
      modelName: "user_portrait_style.safetensors",
      strength: 0.50  // Subtle portrait influence
    },
    {
      id: "lora-2",
      modelName: "user_film_grain.safetensors",
      strength: 0.30  // Light film effect
    },
    {
      id: "lora-3",
      modelName: "user_color_grading.safetensors",
      strength: 0.40  // Medium color grading
    }
  ]
};

// Example 5: No LoRA (Base Model Only)
// =====================================
const baseModelConfig = {
  prompt: "beautiful sunset over mountains",
  loras: []  // Empty array = use base FLUX model only
};

// Example 6: Progressive Strength Testing
// ========================================
// Useful for finding the perfect balance
const progressiveTestConfigs = [
  {
    name: "Weak influence",
    loras: [
      { id: "lora-1", modelName: "user_style.safetensors", strength: 0.50 }
    ]
  },
  {
    name: "Medium influence",
    loras: [
      { id: "lora-1", modelName: "user_style.safetensors", strength: 0.75 }
    ]
  },
  {
    name: "Strong influence",
    loras: [
      { id: "lora-1", modelName: "user_style.safetensors", strength: 0.95 }
    ]
  }
];

// Example 7: Creative Mixing
// ===========================
// Combine different style elements for unique results
const creativeMixConfig = {
  prompt: "ethereal goddess in a cosmic garden",
  loras: [
    {
      id: "lora-1",
      modelName: "user_fantasy_character.safetensors",
      strength: 0.90  // Strong fantasy character base
    },
    {
      id: "lora-2",
      modelName: "user_surreal_art.safetensors",
      strength: 0.65  // Medium surreal artistic style
    },
    {
      id: "lora-3",
      modelName: "user_cosmic_effects.safetensors",
      strength: 0.55  // Moderate cosmic atmosphere
    },
    {
      id: "lora-4",
      modelName: "user_nature_elements.safetensors",
      strength: 0.45  // Subtle natural elements
    }
  ]
};

// ============================================
// Workflow Generation Logic
// ============================================
/**
 * How multiple LoRAs are chained in ComfyUI:
 * 
 * Node 6: Base FLUX Model (UNETLoader)
 *    ↓
 * Node 14: First LoRA @ 90% strength
 *    ↓
 * Node 15: Second LoRA @ 65% strength
 *    ↓
 * Node 16: Third LoRA @ 55% strength
 *    ↓
 * Node 17: Fourth LoRA @ 45% strength
 *    ↓
 * Node 9: ModelSamplingFlux (uses final chained model)
 *    ↓
 * Node 12: KSampler (generates image)
 * 
 * Each LoRA modifies the model output from the previous node,
 * creating a cumulative effect.
 */

// ============================================
// Best Practices
// ============================================
/**
 * 1. STRENGTH GUIDELINES:
 *    - 0.90-1.00: Very strong influence (use for primary style)
 *    - 0.70-0.85: Strong influence (use for secondary style)
 *    - 0.50-0.65: Medium influence (use for details/atmosphere)
 *    - 0.30-0.45: Subtle influence (use for fine-tuning)
 *    - 0.00-0.25: Very subtle (use for minimal adjustments)
 * 
 * 2. ORDERING STRATEGY:
 *    - Place most important LoRA first (strongest base)
 *    - Add refinement LoRAs after
 *    - Detail LoRAs should come last
 *    - Later LoRAs modify earlier ones
 * 
 * 3. RECOMMENDED LIMITS:
 *    - Start with 1-2 LoRAs
 *    - Add up to 3-5 for complex compositions
 *    - More than 5 may cause conflicting styles
 * 
 * 4. TESTING APPROACH:
 *    - Test each LoRA individually first
 *    - Then combine in pairs
 *    - Adjust strengths based on results
 *    - Document successful combinations
 * 
 * 5. COMMON COMBINATIONS:
 *    - Character + Environment
 *    - Style + Details
 *    - Base + Refinement + Effects
 *    - Primary Style + Secondary Style + Color Grading
 */

// ============================================
// Troubleshooting
// ============================================
/**
 * ISSUE: LoRAs conflict or create weird results
 * SOLUTION: Reduce strength of conflicting LoRAs or reorder them
 * 
 * ISSUE: Effect too strong
 * SOLUTION: Lower the strength values (try 0.6-0.7 instead of 0.9)
 * 
 * ISSUE: LoRA barely visible
 * SOLUTION: Increase strength or move it earlier in the chain
 * 
 * ISSUE: One LoRA overpowers others
 * SOLUTION: Reduce its strength and increase others
 * 
 * ISSUE: Results inconsistent
 * SOLUTION: Use fixed seed for testing, adjust one LoRA at a time
 */

export {
  singleLoRAConfig,
  doubleLoRAConfig,
  tripleLoRAConfig,
  subtleBlendConfig,
  baseModelConfig,
  progressiveTestConfigs,
  creativeMixConfig
};
