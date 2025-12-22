'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Upload, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';

interface Model {
  id: string;
  name: string;
  price: number;
  status: 'available' | 'sold';
  imageUrl: string;
  category: string;
  gallery: string[];
  description: string;
  included: string[];
  usedFor: string[];
}

export default function AIMarketplaceTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState<number | null>(null);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    status: 'available' as 'available' | 'sold',
    imageUrl: '',
    gallery: ['', '', '', ''],
    description: '',
    included: [''],
    usedFor: [''],
  });

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/marketplace');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      price: '',
      status: 'available',
      imageUrl: '',
      gallery: ['', '', '', ''],
      description: '',
      included: [''],
      usedFor: [''],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (model: Model) => {
    setModalMode('edit');
    setSelectedModel(model);
    setFormData({
      name: model.name,
      price: model.price.toString(),
      status: model.status,
      imageUrl: model.imageUrl,
      gallery: model.gallery,
      description: model.description,
      included: model.included,
      usedFor: model.usedFor,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedModel(null);
      setFormData({
        name: '',
        price: '',
        status: 'available',
        imageUrl: '',
        gallery: ['', '', '', ''],
        description: '',
        included: [''],
        usedFor: [''],
      });
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that main image is uploaded
    if (!formData.imageUrl || formData.imageUrl.trim() === '') {
      alert('Please upload a main image');
      return;
    }
    
    const modelData = {
      name: formData.name,
      price: parseFloat(formData.price),
      status: formData.status,
      imageUrl: formData.imageUrl,
      category: 'Premium',
      gallery: formData.gallery.filter(url => url.trim() !== ''),
      description: formData.description,
      included: formData.included.filter(item => item.trim() !== ''),
      usedFor: formData.usedFor.filter(item => item.trim() !== ''),
    };

    try {
      if (modalMode === 'add') {
        const response = await fetch('/api/admin/marketplace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modelData),
        });
        
        if (response.ok) {
          await fetchModels();
        }
      } else if (modalMode === 'edit' && selectedModel) {
        const response = await fetch('/api/admin/marketplace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedModel.id, ...modelData }),
        });
        
        if (response.ok) {
          await fetchModels();
        }
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving model:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this model?')) {
      try {
        const response = await fetch(`/api/admin/marketplace?id=${id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          await fetchModels();
        }
      } catch (error) {
        console.error('Error deleting model:', error);
      }
    }
  };

  const addField = (field: 'included' | 'usedFor') => {
    setFormData({
      ...formData,
      [field]: [...formData[field], ''],
    });
  };

  const removeField = (field: 'included' | 'usedFor', index: number) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((_, i) => i !== index),
    });
  };

  const updateField = (field: 'included' | 'usedFor', index: number, value: string) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({
      ...formData,
      [field]: newArray,
    });
  };

  const updateGallery = (index: number, value: string) => {
    const newGallery = [...formData.gallery];
    newGallery[index] = value;
    setFormData({
      ...formData,
      gallery: newGallery,
    });
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload image');

      const { url } = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingGallery(index);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload image');

      const { url } = await response.json();
      updateGallery(index, url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingGallery(null);
    }
  };

  const availableModels = models.filter(m => m.status === 'available');
  const soldModels = models.filter(m => m.status === 'sold');

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI Marketplace Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Manage available and sold models
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Add Model</span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <h3 className="text-sm font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Available Models</h3>
              <p className="text-5xl font-bold text-green-600 dark:text-green-400 mt-3">{availableModels.length}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-700/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <h3 className="text-sm font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Sold Models</h3>
              <p className="text-5xl font-bold text-red-600 dark:text-red-400 mt-3">{soldModels.length}</p>
            </div>
          </div>

      {/* Available Models Section */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <div className="w-1.5 h-8 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full mr-3"></div>
          Available Models
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableModels.map((model) => (
            <div
              key={model.id}
              className="bg-white dark:bg-gray-800/50 rounded-2xl border-2 border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative h-56 w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                {model.imageUrl && (
                  <Image
                    src={model.imageUrl}
                    alt={model.name}
                    fill
                    className="object-contain p-4"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{model.name}</h4>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">${model.price}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{model.category}</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(model)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {availableModels.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No available models</p>
        )}
      </div>

      {/* Sold Models Section */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <div className="w-1.5 h-8 bg-gradient-to-b from-red-500 to-rose-500 rounded-full mr-3"></div>
          Sold Models
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {soldModels.map((model) => (
            <div
              key={model.id}
              className="bg-white dark:bg-gray-800/50 rounded-2xl border-2 border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-lg opacity-75"
            >
              <div className="relative h-56 w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                {model.imageUrl && (
                  <Image
                    src={model.imageUrl}
                    alt={model.name}
                    fill
                    className="object-contain p-4 grayscale"
                  />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white text-2xl font-bold tracking-wider">SOLD</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{model.name}</h4>
                  <span className="text-xl font-bold text-gray-500 dark:text-gray-400">${model.price}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{model.category}</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(model)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {soldModels.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No sold models</p>
        )}
      </div>
        </>
      )}

      {/* Add/Edit Model Modal */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={closeModal}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-blue-400 [&::-webkit-scrollbar-thumb]:to-purple-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-gray-100 dark:[&::-webkit-scrollbar-thumb]:border-gray-900 hover:[&::-webkit-scrollbar-thumb]:from-blue-500 hover:[&::-webkit-scrollbar-thumb]:to-purple-600"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {modalMode === 'add' ? 'Add New Model' : 'Edit Model'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Model Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        placeholder="Enter model name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Price ($) *
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        placeholder="999"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'sold' })}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      >
                        <option value="available">Available</option>
                        <option value="sold">Sold</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      placeholder="Enter model description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Main Image *
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={mainImageInputRef}
                          onChange={handleMainImageUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => mainImageInputRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                        </button>
                      </div>
                      {formData.imageUrl && (
                        <div className="relative h-32 w-32 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                          <Image
                            src={formData.imageUrl}
                            alt="Main preview"
                            fill
                            className="object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gallery */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gallery (4 Images)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.gallery.map((url, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Image {index + 1}
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => { galleryInputRefs.current[index] = el; }}
                              onChange={(e) => handleGalleryImageUpload(index, e)}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => galleryInputRefs.current[index]?.click()}
                              disabled={uploadingGallery === index}
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                            >
                              <Upload className="w-4 h-4" />
                              <span>{uploadingGallery === index ? 'Uploading...' : 'Upload'}</span>
                            </button>
                          </div>
                          {url && (
                            <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                              <Image
                                src={url}
                                alt={`Gallery ${index + 1}`}
                                fill
                                className="object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What's Included */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">What's Included</h3>
                    <button
                      type="button"
                      onClick={() => addField('included')}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>
                  {formData.included.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateField('included', index, e.target.value)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        placeholder="Enter what's included"
                      />
                      {formData.included.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField('included', index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Used For */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Used For</h3>
                    <button
                      type="button"
                      onClick={() => addField('usedFor')}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>
                  {formData.usedFor.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateField('usedFor', index, e.target.value)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        placeholder="Enter use case"
                      />
                      {formData.usedFor.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField('usedFor', index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-xl active:scale-95"
                  >
                    {modalMode === 'add' ? 'Add Model' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
