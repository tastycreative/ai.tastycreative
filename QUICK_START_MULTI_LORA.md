# 🚀 Quick Start: Multi-LoRA Stack Feature

## What You Can Do Now

You can now **stack multiple LoRA models** just like rgthree's Power LoRA Loader in ComfyUI! This gives you professional-level control over your AI-generated images.

## 🎯 Quick Start (3 Steps)

### Step 1: Open the Text-to-Image Page
Navigate to: **Workspace → Generate Content → Text-to-Image**

### Step 2: Add Your First LoRA
1. Look for the **"AI Style Models (LoRA)"** section
2. Click **"+ Add Another LoRA"** button
3. Select your model from the dropdown
4. Adjust the strength slider (0-100%)

### Step 3: Stack More LoRAs (Optional)
1. Click **"+ Add Another LoRA"** again
2. Select a different model
3. Adjust its strength independently
4. Repeat as needed!

Then click **Generate** and watch the magic happen! ✨

## 💡 Example Use Case

**Scenario**: Create a fashion model image with custom style and lighting

```
1. Add LoRA 1: "Fashion Model A" @ 95% strength
   ↓ Gives you the base character/pose
   
2. Add LoRA 2: "Studio Lighting" @ 70% strength
   ↓ Adds professional lighting
   
3. Add LoRA 3: "Color Grading Warm" @ 50% strength
   ↓ Adds warm color tones
   
Generate! 🎨
```

## 🎨 What Each LoRA Does

Think of LoRAs like **transparent layers** in Photoshop:
- **First LoRA** = Base layer (strongest influence)
- **Second LoRA** = Refinement layer (medium influence)
- **Third LoRA** = Details layer (subtle touches)
- And so on...

They **stack** on top of each other, creating unique combinations!

## 🎚️ Strength Guide (Quick Reference)

| Strength | When to Use | Example |
|----------|-------------|---------|
| **90-100%** | Primary style | Base character model |
| **70-85%** | Secondary style | Artistic direction |
| **50-65%** | Medium details | Lighting, atmosphere |
| **30-45%** | Subtle touches | Color grading, effects |

## ⚡ Pro Tips

1. **Start Simple**: Try 1-2 LoRAs first before stacking more
2. **Test Individually**: Try each LoRA alone, then combine
3. **Order Matters**: First LoRA has the strongest base influence
4. **Adjust Strengths**: Too strong? Lower the percentage!
5. **Mix & Match**: Experiment with different combinations

## 🔥 Popular Combinations

### Portrait Photography
```
1. Portrait Model @ 95%
2. Studio Lighting @ 70%
3. Skin Texture @ 50%
```

### Fantasy Art
```
1. Fantasy Character @ 90%
2. Magical Effects @ 65%
3. Ethereal Atmosphere @ 55%
```

### Fashion Editorial
```
1. Fashion Model @ 95%
2. Haute Couture Style @ 80%
3. Dramatic Lighting @ 60%
4. Color Grading @ 45%
```

## 🎮 UI Elements

### What You'll See

```
┌─────────────────────────────────────┐
│ AI Style Models (LoRA) [Multi-Stack]│ ← Header
│                           ● 2 Active │ ← Shows how many are active
├─────────────────────────────────────┤
│ [LoRA 1] ●                      [×] │ ← Remove button
│ Model: Fashion Model A         ▼   │ ← Dropdown selector
│ Strength: 95% [████████████░]      │ ← Strength slider
│ Size: 143.5MB • Uploaded: Oct 1    │ ← Model info
├─────────────────────────────────────┤
│ [LoRA 2] ●                      [×] │
│ Model: Studio Lighting         ▼   │
│ Strength: 70% [██████████░░░]      │
│ Size: 89.2MB • Uploaded: Sep 28    │
├─────────────────────────────────────┤
│ ┊ [+] Add Another LoRA ┊           │ ← Add more!
├─────────────────────────────────────┤
│ ✓ 2 Style Models Active            │ ← Summary
│   Applied in sequence (stacked)    │
└─────────────────────────────────────┘
```

## 🎬 Your First Generation

### Try This Now!

1. **Prompt**: "beautiful woman in elegant dress"
2. **Add LoRA**: Select your favorite model @ 95%
3. **Click Generate**
4. **See Results** → Then try adding a second LoRA!

### Advanced Try

1. **Prompt**: "cyberpunk character in neon city"
2. **LoRA 1**: Cyberpunk style @ 90%
3. **LoRA 2**: Neon effects @ 70%
4. **LoRA 3**: Urban environment @ 60%
5. **Generate** → See how they stack!

## ❓ Common Questions

**Q: How many LoRAs can I stack?**
A: No limit! But 3-5 is recommended for best results.

**Q: What if they conflict?**
A: Lower the strength of one or both, or try different LoRAs.

**Q: Can I remove a LoRA?**
A: Yes! Click the [×] button on any LoRA card.

**Q: What order should they be in?**
A: Most important first, details last. But experiment!

**Q: Will it work with my old saves?**
A: Yes! Your old single-LoRA settings are automatically migrated.

## 🎓 Learning Path

### Beginner
- ✅ Start with 1 LoRA
- ✅ Learn how strength affects results
- ✅ Try different models

### Intermediate  
- ✅ Stack 2 LoRAs
- ✅ Experiment with combinations
- ✅ Find your favorite pairs

### Advanced
- ✅ Stack 3-5 LoRAs
- ✅ Create complex compositions
- ✅ Master strength balancing

## 🌟 What Makes This Awesome

- **No Code Required**: Just point and click!
- **Real-Time Feedback**: See settings as you adjust
- **Unlimited Creativity**: Mix any models you want
- **Professional Results**: Same power as ComfyUI Power LoRA Loader
- **Easy to Learn**: Intuitive UI guides you

## 🎉 Ready to Create!

You're all set! Head to the **Text-to-Image** page and start stacking LoRAs!

### Quick Access
```
Dashboard → Workspace → Generate Content → Text-to-Image
```

**Happy Creating! 🎨✨**

---

Need help? Check:
- `MULTI_LORA_FEATURE.md` - Technical details
- `docs/MULTI_LORA_EXAMPLES.js` - Code examples
- `docs/MULTI_LORA_UI_GUIDE.md` - Visual guide
