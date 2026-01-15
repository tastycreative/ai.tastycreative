"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import Cropper, { Area } from "react-easy-crop";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Loader2,
  Save,
  AlertCircle,
  Camera,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Settings,
  Sparkles,
  Database,
  KeyRound,
} from "lucide-react";

interface UserProfile {
  id: string;
  clerkId: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  role: string;
}

export default function SettingsPage() {
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
  });

  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/user/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const data = await response.json();
        setUserProfile(data);
        setFormData({
          username: data.username || "",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check username availability when username field changes
    if (name === "username" && value.trim() !== "") {
      // Debounce the username check
      setCheckingUsername(true);
      setUsernameAvailable(null);

      // Clear any existing timeout
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }

      // Set new timeout
      usernameCheckTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/user/check-username?username=${encodeURIComponent(value)}`
          );
          const data = await response.json();
          setUsernameAvailable(data.available);
        } catch (error) {
          console.error("Error checking username:", error);
        } finally {
          setCheckingUsername(false);
        }
      }, 500); // Wait 500ms after user stops typing
    } else if (name === "username" && value.trim() === "") {
      setUsernameAvailable(null);
      setCheckingUsername(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Check if username has changed and is taken
      if (formData.username && formData.username !== userProfile?.username) {
        // Final check before saving
        const checkResponse = await fetch(
          `/api/user/check-username?username=${encodeURIComponent(formData.username)}`
        );
        const checkData = await checkResponse.json();

        if (!checkData.available) {
          toast.error("Username is already taken");
          setSaving(false);
          return;
        }
      }

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedData = await response.json();
      setUserProfile(updatedData);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Callback when crop is complete
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Create cropped image from canvas
  const createCroppedImage = async (): Promise<Blob | null> => {
    if (!imageToCrop || !croppedAreaPixels) return null;

    const image = new Image();
    image.src = imageToCrop;
    
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Set canvas size to desired output size (square for avatar)
    const outputSize = 400;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Calculate rotation
    const radians = (rotation * Math.PI) / 180;
    
    // Draw the cropped and rotated image
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outputSize, outputSize);
    
    // Move to center, rotate, then draw
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate(radians);
    ctx.translate(-outputSize / 2, -outputSize / 2);
    
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outputSize,
      outputSize
    );
    ctx.restore();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
    });
  };

  // Handle file selection - open crop modal
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.");
      return;
    }

    // Validate file size (max 10MB for original, will be compressed after crop)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    // Read the file and open crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setOriginalFile(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Cancel cropping
  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setOriginalFile(null);
    setCroppedAreaPixels(null);
  };

  // Confirm crop and upload
  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) {
      toast.error("Please adjust your crop selection");
      return;
    }

    try {
      setUploadingAvatar(true);
      
      const croppedBlob = await createCroppedImage();
      if (!croppedBlob) {
        throw new Error("Failed to crop image");
      }

      const formData = new FormData();
      formData.append("file", croppedBlob, "avatar.jpg");

      const response = await fetch("/api/user/profile/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload avatar");
      }

      const data = await response.json();
      setUserProfile(data.user);
      setShowCropModal(false);
      setImageToCrop(null);
      setOriginalFile(null);
      toast.success("Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!userProfile?.imageUrl) return;

    try {
      setUploadingAvatar(true);
      const response = await fetch("/api/user/profile/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete avatar");
      }

      const data = await response.json();
      setUserProfile(data.user);
      toast.success("Profile picture removed successfully!");
    } catch (error) {
      console.error("Error deleting avatar:", error);
      toast.error("Failed to remove profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-500/20 text-red-200 border-red-500/30";
      case "CONTENT_CREATOR":
        return "bg-purple-500/20 text-purple-200 border-purple-500/30";
      case "MANAGER":
        return "bg-amber-500/20 text-amber-200 border-amber-500/30";
      default:
        return "bg-cyan-500/20 text-cyan-200 border-cyan-500/30";
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-slate-300">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-50">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-slate-300">Failed to load profile data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 shadow-2xl shadow-cyan-900/30 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Profile Picture with Upload Overlay */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 p-1 shadow-lg shadow-cyan-900/50">
                <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                  {userProfile.imageUrl ? (
                    <img
                      src={userProfile.imageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-3xl font-bold">
                      {formData.firstName?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Upload Overlay */}
              <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                {uploadingAvatar ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
              
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploadingAvatar}
              />
              
              {/* Delete Button */}
              {userProfile.imageUrl && (
                <button
                  onClick={handleAvatarDelete}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-xl flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                  title="Remove profile picture"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-900/50">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Account</p>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">Profile Settings</h1>
                </div>
              </div>
              <p className="text-sm text-slate-300 mt-2">
                Manage your account information, preferences, and profile picture.
              </p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                Hover over your avatar to change it
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Personal Information</h2>
          </div>

          <div className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  placeholder="Enter your username"
                />
              </div>
              {checkingUsername && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking availability...
                </p>
              )}
              {usernameAvailable === true && formData.username && (
                <p className="text-xs text-emerald-400">✓ Username is available</p>
              )}
              {usernameAvailable === false && formData.username && (
                <p className="text-xs text-red-400">✗ Username is already taken</p>
              )}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">First Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    placeholder="Enter your first name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Last Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-6 py-3 font-semibold text-white shadow-xl shadow-cyan-900/40 transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Account Information</h2>
          </div>

          <div className="space-y-1">
            {/* Role */}
            <div className="flex items-center justify-between py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-slate-400" />
                <span className="text-slate-200 font-medium">Account Role</span>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold border ${getRoleBadgeColor(userProfile.role)}`}>
                {userProfile.role.replace("_", " ")}
              </span>
            </div>

            {/* User ID */}
            <div className="flex items-center justify-between py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <span className="text-slate-200 font-medium">User ID</span>
              </div>
              <span className="text-slate-400 text-sm font-mono bg-slate-900/50 px-3 py-1.5 rounded-xl border border-white/10">
                {userProfile.id.substring(0, 8)}...
              </span>
            </div>

            {/* Account Created */}
            <div className="flex items-center justify-between py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-slate-200 font-medium">Account Created</span>
              </div>
              <span className="text-slate-400 text-sm">
                {formatDate(userProfile.createdAt)}
              </span>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-slate-200 font-medium">Last Updated</span>
              </div>
              <span className="text-slate-400 text-sm">
                {formatDate(userProfile.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Database Details Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Database Information</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 overflow-x-auto">
            <pre className="text-xs text-emerald-400 font-mono">
              {JSON.stringify(userProfile, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Image Crop Modal */}
      {showCropModal && imageToCrop && typeof window !== 'undefined' && document?.body && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-cyan-900/40 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Crop Profile Picture</h3>
              </div>
              <button
                onClick={handleCropCancel}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Crop Area */}
            <div className="relative h-80 bg-slate-950">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls */}
            <div className="px-6 py-4 space-y-4 bg-white/5">
              {/* Zoom Control */}
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <ZoomIn className="w-4 h-4 text-slate-400" />
              </div>

              {/* Rotation Control */}
              <div className="flex items-center gap-3">
                <RotateCw className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-sm text-slate-400 w-12 text-right">
                  {rotation}°
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={handleCropCancel}
                disabled={uploadingAvatar}
                className="px-4 py-2.5 text-slate-300 hover:bg-white/10 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                disabled={uploadingAvatar}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-5 py-2.5 font-semibold text-white shadow-xl shadow-cyan-900/40 transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
              >
                {uploadingAvatar ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Apply
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
