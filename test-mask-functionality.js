// Test script to validate mask generation and upload
// This can be run in the browser console on the face swap page

function testMaskFunctionality() {
  console.log("🧪 Testing mask functionality...");

  // Check if mask canvas exists
  const maskCanvas = document.querySelector(
    'canvas[style*="position: absolute"]'
  );
  if (!maskCanvas) {
    console.error("❌ Mask canvas not found");
    return;
  }

  console.log("✅ Mask canvas found:", maskCanvas);

  // Check if mask canvas has content
  const ctx = maskCanvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const hasContent = imageData.data.some(
    (_, i) => i % 4 === 3 && imageData.data[i] > 0
  );

  console.log("🎭 Mask canvas state:", {
    width: maskCanvas.width,
    height: maskCanvas.height,
    hasContent: hasContent,
  });

  if (hasContent) {
    const maskDataUrl = maskCanvas.toDataURL("image/png");
    console.log("🎭 Mask data URL generated:", {
      length: maskDataUrl.length,
      preview: maskDataUrl.substring(0, 100) + "...",
    });

    // Test converting to blob
    fetch(maskDataUrl)
      .then((response) => response.blob())
      .then((blob) => {
        console.log("✅ Mask blob conversion successful:", {
          size: blob.size,
          type: blob.type,
        });
      })
      .catch((error) => {
        console.error("❌ Mask blob conversion failed:", error);
      });
  } else {
    console.log("⚠️ No mask content - try drawing on the canvas first");
  }
}

// Run the test
testMaskFunctionality();
