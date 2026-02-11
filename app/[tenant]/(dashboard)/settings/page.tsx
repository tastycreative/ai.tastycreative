"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
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
  Building2,
  Users,
  Crown,
  Plus,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  memberRole?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER';
  canManage?: boolean;
  members?: OrganizationMember[];
}

interface OrganizationMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  };
}

export default function SettingsPage() {
  const { user } = useUser();
  const params = useParams();
  const tenant = params.tenant as string;
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const orgLogoInputRef = useRef<HTMLInputElement | null>(null);
  
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

  const [orgFormData, setOrgFormData] = useState({
    name: "",
    description: "",
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

  // Fetch organization data
  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setLoadingOrg(true);
        const response = await fetch("/api/organization/current");
        if (response.ok) {
          const data = await response.json();
          if (data.organization) {
            setOrganization(data.organization);
            setOrgFormData({
              name: data.organization.name || "",
              description: data.organization.description || "",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching organization:", error);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrganization();
  }, []);

  // Handle hash navigation after page loads
  useEffect(() => {
    if (!loading && !loadingOrg) {
      const hash = window.location.hash;
      if (hash) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [loading, loadingOrg]);

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

  const handleOrgInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setOrgFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOrgSave = async () => {
    if (!organization?.canManage) {
      toast.error("You don't have permission to update organization settings");
      return;
    }

    try {
      setSavingOrg(true);
      const response = await fetch("/api/organization/current", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orgFormData),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization");
      }

      const data = await response.json();
      setOrganization(data.organization);
      toast.success("Organization updated successfully!");
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Failed to update organization");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleOrgLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!organization?.canManage) {
      toast.error("You don't have permission to update organization logo");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    try {
      setUploadingOrgLogo(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/organization/logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload logo");
      }

      const data = await response.json();
      setOrganization(data.organization);
      toast.success("Organization logo updated successfully!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploadingOrgLogo(false);
      if (orgLogoInputRef.current) {
        orgLogoInputRef.current.value = "";
      }
    }
  };

  const handleOrgLogoDelete = async () => {
    if (!organization?.canManage || !organization?.logoUrl) return;

    try {
      setUploadingOrgLogo(true);
      const response = await fetch("/api/organization/logo", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete logo");
      }

      const data = await response.json();
      setOrganization(data.organization);
      toast.success("Organization logo removed successfully!");
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast.error("Failed to remove logo");
    } finally {
      setUploadingOrgLogo(false);
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
        return "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/20 dark:text-red-200 dark:border-red-500/30";
      case "CONTENT_CREATOR":
        return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30";
      case "MANAGER":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30";
      default:
        return "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/30";
    }
  };

  const getOrgRoleBadgeColor = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30";
      case "ADMIN":
        return "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/20 dark:text-red-200 dark:border-red-500/30";
      case "MANAGER":
        return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30";
      case "CREATOR":
        return "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/30";
      default:
        return "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-500/20 dark:text-zinc-200 dark:border-zinc-500/30";
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-white dark:bg-[#1a1625]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#6366F1]/5 dark:bg-[#6366F1]/10 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#EC67A1] mx-auto mb-4" />
            <p className="text-zinc-700 dark:text-zinc-300">Loading your profile...</p>
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
    <div className="relative min-h-screen bg-white dark:bg-[#1a1625] text-zinc-900 dark:text-white">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#6366F1]/5 dark:bg-[#6366F1]/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-zinc-300/20 dark:via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header Card */}
        <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Profile Picture with Upload Overlay */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#6366F1] p-1 shadow-lg shadow-[#EC67A1]/30">
                <div className="w-full h-full rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {userProfile.imageUrl ? (
                    <img
                      src={userProfile.imageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-zinc-900 dark:text-white text-3xl font-bold">
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
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#6366F1] shadow-lg shadow-[#EC67A1]/30">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Account</p>
                  <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">Profile Settings</h1>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">
                Manage your account information, preferences, and profile picture.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                Hover over your avatar to change it
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information Card */}
        <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Personal Information</h2>
          </div>

          <div className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                  placeholder="Enter your username"
                />
              </div>
              {checkingUsername && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking availability...
                </p>
              )}
              {usernameAvailable === true && formData.username && (
                <p className="text-xs text-emerald-500 dark:text-emerald-400">✓ Username is available</p>
              )}
              {usernameAvailable === false && formData.username && (
                <p className="text-xs text-red-500 dark:text-red-400">✗ Username is already taken</p>
              )}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">First Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                    placeholder="Enter your first name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Last Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EC67A1] via-[#F774B9] to-[#6366F1] px-6 py-3 font-semibold text-white shadow-xl shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 disabled:from-zinc-400 disabled:to-zinc-500 disabled:shadow-none"
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
        <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/20 text-[#6366F1]">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Account Information</h2>
          </div>

          <div className="space-y-1">
            {/* Role */}
            <div className="flex items-center justify-between py-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">Account Role</span>
              </div>
              <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold border ${getRoleBadgeColor(userProfile.role)}`}>
                {userProfile.role.replace("_", " ")}
              </span>
            </div>

            {/* User ID */}
            <div className="flex items-center justify-between py-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">User ID</span>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400 text-sm font-mono bg-zinc-100 dark:bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10">
                {userProfile.id.substring(0, 8)}...
              </span>
            </div>

            {/* Account Created */}
            <div className="flex items-center justify-between py-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">Account Created</span>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400 text-sm">
                {formatDate(userProfile.createdAt)}
              </span>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-200 font-medium">Last Updated</span>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400 text-sm">
                {formatDate(userProfile.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links Card */}
        <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/20 text-[#6366F1]">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Quick Links</h2>
          </div>

          <div className="space-y-3">
            {/* Pricing Templates Link */}
            <Link
              href={`/${tenant}/settings/pricing-templates`}
              className="group flex items-center justify-between p-4 rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 hover:border-[#EC67A1]/30 hover:bg-[#EC67A1]/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-300">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white group-hover:text-[#EC67A1] transition-colors">
                    Pricing Templates
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Create and manage reusable pricing templates for OF Creators
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400 group-hover:text-[#EC67A1] group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        {/* Organization Settings Card */}
        {!loadingOrg && !organization && (
          <div id="organization" className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/20 text-[#6366F1]">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create Organization</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Start your own organization to collaborate with team members
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-[#6366F1]/20 bg-gradient-to-br from-[#6366F1]/5 to-[#EC67A1]/5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#EC67A1] flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Why create an organization?</h3>
                    <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-[#6366F1] mt-0.5">•</span>
                        <span>Share Instagram profiles with your team members</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#6366F1] mt-0.5">•</span>
                        <span>Collaborate on content creation and management</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#6366F1] mt-0.5">•</span>
                        <span>Invite team members with different roles and permissions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#6366F1] mt-0.5">•</span>
                        <span>Centralized billing and subscription management</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-white/10">
                  <button
                    onClick={() => setShowCreateOrgModal(true)}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#6366F1] to-[#EC67A1] px-6 py-3 font-semibold text-white shadow-xl shadow-[#6366F1]/30 transition hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create Organization
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {organization && (
          <div id="organization" className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/20 text-[#6366F1]">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Organization Settings</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {organization.canManage
                    ? "Manage your organization's information and members"
                    : "View your organization's information"}
                </p>
              </div>
              {organization.memberRole && (
                <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 ${getOrgRoleBadgeColor(organization.memberRole)}`}>
                  {organization.memberRole === 'OWNER' && <Crown className="w-3 h-3" />}
                  {organization.memberRole}
                </span>
              )}
            </div>

            <div className="space-y-6">
              {/* Organization Logo */}
              <div className="flex items-center gap-6 p-4 rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#EC67A1] p-1 shadow-lg">
                    <div className="w-full h-full rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                      {organization.logoUrl ? (
                        <img
                          src={organization.logoUrl}
                          alt="Organization Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {organization.canManage && (
                    <>
                      {/* Upload Overlay */}
                      <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        {uploadingOrgLogo ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Hidden File Input */}
                      <input
                        ref={orgLogoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleOrgLogoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingOrgLogo}
                      />

                      {/* Delete Button */}
                      {organization.logoUrl && (
                        <button
                          onClick={handleOrgLogoDelete}
                          disabled={uploadingOrgLogo}
                          className="absolute -bottom-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                          title="Remove organization logo"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{organization.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {organization.canManage
                      ? "Hover over logo to change it"
                      : "Organization logo"}
                  </p>
                </div>
              </div>

              {/* Organization Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Organization Name</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <input
                    type="text"
                    name="name"
                    value={orgFormData.name}
                    onChange={handleOrgInputChange}
                    disabled={!organization.canManage}
                    className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Enter organization name"
                  />
                </div>
              </div>

              {/* Organization Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <textarea
                    name="description"
                    value={orgFormData.description}
                    onChange={handleOrgInputChange}
                    disabled={!organization.canManage}
                    rows={3}
                    className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                    placeholder="Enter organization description"
                  />
                </div>
              </div>

              {/* Save Button */}
              {organization.canManage && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleOrgSave}
                    disabled={savingOrg}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#6366F1] to-[#EC67A1] px-6 py-3 font-semibold text-white shadow-xl shadow-[#6366F1]/30 transition hover:-translate-y-0.5 disabled:from-zinc-400 disabled:to-zinc-500 disabled:shadow-none"
                  >
                    {savingOrg ? (
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
              )}

              {/* Organization Members */}
              {organization.members && organization.members.length > 0 && (
                <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Team Members</h3>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">({organization.members.length})</span>
                  </div>
                  <div className="space-y-2">
                    {organization.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-[#6366F1] to-[#EC67A1] flex items-center justify-center flex-shrink-0">
                          {member.user.imageUrl ? (
                            <img src={member.user.imageUrl} alt={member.user.name || 'Member'} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-sm font-bold">
                              {member.user.name?.charAt(0)?.toUpperCase() || member.user.email?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                            {member.user.name || member.user.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 ${getOrgRoleBadgeColor(member.role)}`}>
                          {member.role === 'OWNER' && <Crown className="w-3 h-3" />}
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Database Details Card */}
        <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-white/5 p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Database Information</h2>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/60 p-4 overflow-x-auto">
            <pre className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
              {JSON.stringify(userProfile, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateOrgModal && typeof window !== 'undefined' && document?.body && createPortal(
        <CreateOrganizationModal
          onClose={() => setShowCreateOrgModal(false)}
          onSuccess={async () => {
            setShowCreateOrgModal(false);

            // Invalidate organizations query to refresh OrganizationSwitcher
            queryClient.invalidateQueries({ queryKey: ['organizations'] });

            // Refetch organization data for settings page
            const response = await fetch("/api/organization/current");
            if (response.ok) {
              const data = await response.json();
              if (data.organization) {
                setOrganization(data.organization);
                setOrgFormData({
                  name: data.organization.name || "",
                  description: data.organization.description || "",
                });
              }
            }
          }}
        />,
        document.body
      )}

      {/* Image Crop Modal */}
      {showCropModal && imageToCrop && typeof window !== 'undefined' && document?.body && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4">
          <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/20 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Crop Profile Picture</h3>
              </div>
              <button
                onClick={handleCropCancel}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>

            {/* Crop Area */}
            <div className="relative h-80 bg-zinc-100 dark:bg-zinc-950">
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
            <div className="px-6 py-4 space-y-4 bg-zinc-50 dark:bg-white/5">
              {/* Zoom Control */}
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#EC67A1]"
                />
                <ZoomIn className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </div>

              {/* Rotation Control */}
              <div className="flex items-center gap-3">
                <RotateCw className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 h-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#EC67A1]"
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400 w-12 text-right">
                  {rotation}°
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-white/10">
              <button
                onClick={handleCropCancel}
                disabled={uploadingAvatar}
                className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                disabled={uploadingAvatar}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#EC67A1] via-[#F774B9] to-[#6366F1] px-5 py-2.5 font-semibold text-white shadow-xl shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 disabled:from-zinc-400 disabled:to-zinc-500 disabled:shadow-none"
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

// Create Organization Modal Component
function CreateOrganizationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const slug = generateSlug(orgName);

  // Check slug availability
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      setCheckingSlug(false);
      return;
    }

    setCheckingSlug(true);
    setSlugAvailable(null);

    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }

    slugCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/organization/check-slug?slug=${encodeURIComponent(slug)}`
        );
        const data = await response.json();
        setSlugAvailable(data.available);
      } catch (error) {
        console.error('Error checking slug:', error);
      } finally {
        setCheckingSlug(false);
      }
    }, 500);
  }, [slug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    if (slug.length < 3) {
      toast.error('Organization name must be at least 3 characters');
      return;
    }

    if (slugAvailable === false) {
      toast.error('This organization name is already taken');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch('/api/organization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName.trim(),
          slug: slug,
          description: orgDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create organization');
      }

      toast.success('Organization created successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4">
      <div className="rounded-3xl border border-[#EC67A1]/20 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/20 max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366F1]/20 text-[#6366F1]">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Create Organization</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {/* Organization Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                placeholder="Enter organization name"
                required
              />
            </div>
            {slug && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">URL:</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">{slug}</span>
                {checkingSlug && (
                  <Loader2 className="w-3 h-3 text-zinc-500 dark:text-zinc-400 animate-spin" />
                )}
                {slugAvailable === true && slug.length >= 3 && (
                  <span className="text-emerald-500 dark:text-emerald-400">✓ Available</span>
                )}
                {slugAvailable === false && (
                  <span className="text-red-500 dark:text-red-400">✗ Already taken</span>
                )}
                {slug.length < 3 && slug.length > 0 && (
                  <span className="text-amber-500 dark:text-amber-400">Must be at least 3 characters</span>
                )}
              </div>
            )}
          </div>

          {/* Organization Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description (Optional)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-white/5 to-transparent" />
              <textarea
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                rows={3}
                className="relative w-full rounded-2xl border border-[#EC67A1]/10 bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40 resize-none"
                placeholder="Enter organization description"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20">
            <p className="text-xs text-[#6366F1] dark:text-[#6366F1]/80">
              You will be the owner of this organization and can invite team members after creation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !orgName.trim() || slug.length < 3 || slugAvailable === false || checkingSlug}
              className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#6366F1] via-[#6366F1] to-[#EC67A1] px-5 py-2.5 font-semibold text-white shadow-xl shadow-[#6366F1]/30 transition hover:-translate-y-0.5 disabled:from-zinc-400 disabled:to-zinc-500 disabled:shadow-none disabled:translate-y-0"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Create Organization
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
