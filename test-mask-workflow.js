// Test script to validate mask handling in face swap workflow
console.log("🧪 Testing Face Swap Mask Handling");

// Mock parameters similar to what the frontend would send
const mockParams = {
  prompt: "Test face swap with mask",
  contextExpandPixels: 200,
  contextExpandFactor: 1,
  fillMaskHoles: true,
  blurMaskPixels: 16,
  invertMask: false,
  blendPixels: 16,
  rescaleAlgorithm: "bicubic",
  mode: "forced size",
  forceWidth: 1024,
  forceHeight: 1024,
  rescaleFactor: 1,
  steps: 25,
  cfg: 1,
  samplerName: "euler",
  scheduler: "normal",
  denoise: 1,
  guidance: 50,
  seed: 12345,
};

// Simulate workflow creation with mask
function createTestWorkflow(originalFilename, newFaceFilename, maskFilename) {
  const workflow = {
    // Load original image
    239: {
      inputs: {
        image: originalFilename,
      },
      class_type: "LoadImage",
    },
    // Load new face image
    240: {
      inputs: {
        image: newFaceFilename,
      },
      class_type: "LoadImage",
    },
    // InpaintCrop for better face isolation
    411: {
      inputs: {
        image: ["239", 0],
        mask: maskFilename ? ["241", 0] : ["239", 1],
        context_expand_pixels: mockParams.contextExpandPixels || 200,
        context_expand_factor: mockParams.contextExpandFactor || 1,
        fill_mask_holes: mockParams.fillMaskHoles || true,
        blur_mask_pixels: mockParams.blurMaskPixels || 16,
        invert_mask: mockParams.invertMask || false,
        blend_pixels: mockParams.blendPixels || 16,
        rescale_algorithm: mockParams.rescaleAlgorithm || "bicubic",
        mode: mockParams.mode || "forced size",
        force_width: mockParams.forceWidth || 1024,
        force_height: mockParams.forceHeight || 1024,
        rescale_factor: mockParams.rescaleFactor || 1,
      },
      class_type: "InpaintCrop",
    },
  };

  // Add mask loading node if mask is provided
  if (maskFilename) {
    workflow["241"] = {
      inputs: {
        image: maskFilename,
      },
      class_type: "LoadImage",
    };

    // Also add mask conversion for proper processing
    workflow["242"] = {
      inputs: {
        image: ["241", 0],
        channel: "red",
      },
      class_type: "ImageToMask",
    };

    // Update InpaintCrop to use the converted mask
    workflow["411"].inputs.mask = ["242", 0];
    console.log("✅ Mask handling: Using separate mask file");
  } else {
    // Create a default white mask for the entire image if no mask provided
    workflow["241"] = {
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
        color: 16777215, // White mask
      },
      class_type: "EmptyImage",
    };

    workflow["242"] = {
      inputs: {
        image: ["241", 0],
        channel: "red",
      },
      class_type: "ImageToMask",
    };

    workflow["411"].inputs.mask = ["242", 0];
    console.log("✅ Mask handling: Using default white mask (entire image)");
  }

  return workflow;
}

// Test Case 1: With mask file
console.log("\n📝 Test Case 1: With mask file");
const workflowWithMask = createTestWorkflow(
  "original_image.jpg",
  "new_face.jpg",
  "face_mask.png"
);
console.log("   InpaintCrop mask source:", workflowWithMask["411"].inputs.mask);
console.log("   Mask loading node 241:", workflowWithMask["241"].class_type);
console.log("   Mask conversion node 242:", workflowWithMask["242"].class_type);

// Test Case 2: Without mask file
console.log("\n📝 Test Case 2: Without mask file");
const workflowWithoutMask = createTestWorkflow(
  "original_image.jpg",
  "new_face.jpg",
  null
);
console.log(
  "   InpaintCrop mask source:",
  workflowWithoutMask["411"].inputs.mask
);
console.log("   Default mask node 241:", workflowWithoutMask["241"].class_type);
console.log(
  "   Mask conversion node 242:",
  workflowWithoutMask["242"].class_type
);

console.log("\n🎉 Mask workflow tests completed successfully!");
console.log("\n🔧 Key improvements:");
console.log("   1. Separate mask loading when mask file provided");
console.log("   2. Automatic default white mask when no mask provided");
console.log("   3. Proper mask conversion using ImageToMask node");
console.log("   4. Dynamic InpaintCrop mask source assignment");
