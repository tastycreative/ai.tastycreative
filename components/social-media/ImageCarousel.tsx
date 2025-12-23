'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  postId: string;
  mediaType?: 'image' | 'video';
  currentImageIndexes: Record<string, number>;
  setCurrentImageIndexes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isPaused?: boolean;
}

const ImageCarousel = React.memo(({ 
  images, 
  postId, 
  mediaType = 'image',
  currentImageIndexes,
  setCurrentImageIndexes,
  isPaused = false
}: ImageCarouselProps) => {
  const currentIndex = currentImageIndexes[postId] || 0;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(false);

  // Intersection Observer to detect if video is visible on screen
  React.useEffect(() => {
    if (!containerRef.current || mediaType !== 'video') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px'
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [mediaType]);

  // Handle video pause/play based on visibility and modal state
  React.useEffect(() => {
    if (videoRef.current && mediaType === 'video') {
      const video = videoRef.current;
      
      if (isPaused || !isVisible) {
        video.pause();
      } else {
        video.play().catch(err => console.log('Play prevented:', err));
      }
    }
  }, [isPaused, isVisible, mediaType]);

  // Preserve video playback position and mute state
  React.useEffect(() => {
    if (videoRef.current && mediaType === 'video' && !isPaused && isVisible) {
      const video = videoRef.current;
      
      if (currentTime > 0 && Math.abs(video.currentTime - currentTime) > 0.5) {
        video.currentTime = currentTime;
      }
      
      if (video.muted !== isMuted) {
        video.muted = isMuted;
      }
      
      if (video.paused) {
        video.play().catch(err => console.log('Play prevented:', err));
      }
    }
  }, [isMuted, mediaType, currentTime, isPaused, isVisible]);

  const videoSrc = React.useMemo(() => images[0], [images[0]]);

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: currentIndex + 1
      }));
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: currentIndex - 1
      }));
    }
  };

  const goToIndex = (index: number) => {
    setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }));
  };

  if (images.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] bg-gradient-to-br from-gray-900 via-black to-gray-900 group flex items-center justify-center overflow-hidden">
      {/* Main Media */}
      {mediaType === 'video' ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            muted={isMuted}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onCanPlay={(e) => {
              const video = e.currentTarget;
              if (video.paused && video.readyState >= 3) {
                video.play().catch(err => console.log('Auto-play prevented:', err));
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute max-w-full max-h-full object-contain z-10 cursor-pointer"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-all z-20 group/mute border border-white/10"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            )}
          </button>
        </>
      ) : (
        images.map((mediaUrl, index) => (
          <img
            key={index}
            src={mediaUrl}
            alt={`Post image ${index + 1}`}
            loading="eager"
            className={`absolute max-w-full max-h-full object-contain transition-opacity duration-500 ease-in-out ${
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          />
        ))
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      {/* Navigation Arrows - Only for multiple images */}
      {mediaType !== 'video' && images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-white" />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            >
              <ChevronRight className="w-6 h-6 text-gray-800 dark:text-white" />
            </button>
          )}
        </>
      )}

      {/* Image Counter Badge */}
      {mediaType !== 'video' && images.length > 1 && (
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-white text-xs font-semibold shadow-lg z-10">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Dots Indicator */}
      {mediaType !== 'video' && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(index);
              }}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? 'w-8 h-2 bg-white shadow-lg'
                  : 'w-2 h-2 bg-white/60 hover:bg-white/80 hover:scale-125'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ImageCarousel.displayName = 'ImageCarousel';

export default ImageCarousel;
