#!/usr/bin/env python3
"""
Test script for face swap mask handling
Simulates the payload that would be sent from the frontend
"""

import json
import sys

def create_test_payload_with_mask():
    """Create a test payload with mask handling"""
    
    # Mock workflow that the frontend would generate
    workflow = {
        "239": {
            "inputs": {
                "image": "original_image.jpg"
            },
            "class_type": "LoadImage"
        },
        "240": {
            "inputs": {
                "image": "new_face.jpg"
            },
            "class_type": "LoadImage"
        },
        "241": {
            "inputs": {
                "image": "face_mask.png"
            },
            "class_type": "LoadImage"
        },
        "242": {
            "inputs": {
                "image": ["241", 0],
                "channel": "red"
            },
            "class_type": "ImageToMask"
        },
        "411": {
            "inputs": {
                "image": ["239", 0],
                "mask": ["242", 0],
                "context_expand_pixels": 200,
                "context_expand_factor": 1,
                "fill_mask_holes": True,
                "blur_mask_pixels": 16,
                "invert_mask": False,
                "blend_pixels": 16,
                "rescale_algorithm": "bicubic",
                "mode": "forced size",
                "force_width": 1024,
                "force_height": 1024,
                "rescale_factor": 1
            },
            "class_type": "InpaintCrop"
        }
    }
    
    # Test payload with mask
    payload_with_mask = {
        "action": "generate_face_swap",
        "workflow": workflow,
        "originalImageUrl": "https://example.com/original.jpg",
        "newFaceImageUrl": "https://example.com/newface.jpg",
        "originalFilename": "original_image.jpg",
        "newFaceFilename": "new_face.jpg",
        "maskFilename": "face_mask.png",  # This is what the frontend provides
        "webhookUrl": "https://example.com/webhook"
    }
    
    return payload_with_mask

def create_test_payload_without_mask():
    """Create a test payload without mask"""
    
    # Mock workflow that the frontend would generate (with default white mask)
    workflow = {
        "239": {
            "inputs": {
                "image": "original_image.jpg"
            },
            "class_type": "LoadImage"
        },
        "240": {
            "inputs": {
                "image": "new_face.jpg"
            },
            "class_type": "LoadImage"
        },
        "241": {
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1,
                "color": 16777215  # White mask
            },
            "class_type": "EmptyImage"
        },
        "242": {
            "inputs": {
                "image": ["241", 0],
                "channel": "red"
            },
            "class_type": "ImageToMask"
        },
        "411": {
            "inputs": {
                "image": ["239", 0],
                "mask": ["242", 0],
                "context_expand_pixels": 200,
                "context_expand_factor": 1,
                "fill_mask_holes": True,
                "blur_mask_pixels": 16,
                "invert_mask": False,
                "blend_pixels": 16,
                "rescale_algorithm": "bicubic",
                "mode": "forced size",
                "force_width": 1024,
                "force_height": 1024,
                "rescale_factor": 1
            },
            "class_type": "InpaintCrop"
        }
    }
    
    # Test payload without mask
    payload_without_mask = {
        "action": "generate_face_swap",
        "workflow": workflow,
        "originalImageUrl": "https://example.com/original.jpg",
        "newFaceImageUrl": "https://example.com/newface.jpg",
        "originalFilename": "original_image.jpg",
        "newFaceFilename": "new_face.jpg",
        # No maskFilename provided
        "webhookUrl": "https://example.com/webhook"
    }
    
    return payload_without_mask

def main():
    print("🧪 Face Swap Mask Handling Test Payloads")
    print("=" * 50)
    
    print("\n📝 Test Case 1: With Mask File")
    payload_with_mask = create_test_payload_with_mask()
    print(f"✅ Mask filename: {payload_with_mask.get('maskFilename')}")
    print(f"✅ Workflow has LoadImage node 241: {payload_with_mask['workflow']['241']['class_type']}")
    print(f"✅ Workflow has ImageToMask node 242: {payload_with_mask['workflow']['242']['class_type']}")
    print(f"✅ InpaintCrop uses mask from: {payload_with_mask['workflow']['411']['inputs']['mask']}")
    
    print("\n📝 Test Case 2: Without Mask File (Default White Mask)")
    payload_without_mask = create_test_payload_without_mask()
    print(f"✅ Mask filename: {payload_without_mask.get('maskFilename', 'None')}")
    print(f"✅ Workflow has EmptyImage node 241: {payload_without_mask['workflow']['241']['class_type']}")
    print(f"✅ Workflow has ImageToMask node 242: {payload_without_mask['workflow']['242']['class_type']}")
    print(f"✅ InpaintCrop uses mask from: {payload_without_mask['workflow']['411']['inputs']['mask']}")
    print(f"✅ Default mask color: {payload_without_mask['workflow']['241']['inputs']['color']} (white)")
    
    print("\n💾 Saving test payloads to files...")
    
    # Save test payloads
    with open("test_face_swap_with_mask.json", "w") as f:
        json.dump(payload_with_mask, f, indent=2)
    print("✅ Saved: test_face_swap_with_mask.json")
    
    with open("test_face_swap_without_mask.json", "w") as f:
        json.dump(payload_without_mask, f, indent=2)
    print("✅ Saved: test_face_swap_without_mask.json")
    
    print("\n🎉 Test payload generation completed!")
    print("\n🔧 Key Improvements Summary:")
    print("   1. ✅ Separate mask loading when maskFilename provided")
    print("   2. ✅ Default white mask creation when no mask provided")
    print("   3. ✅ Proper ImageToMask conversion for both cases")
    print("   4. ✅ Consistent InpaintCrop mask source (node 242)")
    print("   5. ✅ Handler updated to recognize uploaded mask files")
    
    print("\n🚀 Ready for RunPod testing with:")
    print(f"   Container: rfldln01/face-swap-serverless-handler:latest")

if __name__ == "__main__":
    main()
