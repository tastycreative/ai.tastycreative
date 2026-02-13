import { VideoEditor } from "@/components/gif-maker/VideoEditor";

export const metadata = {
  title: "GIF Maker v2.0 - Enhanced",
  description: "Create professional GIFs with advanced effects, filters, and export options",
};

export default function GifMakerPageEnhanced() {
  return (
    <div className="relative h-screen overflow-hidden">
      <VideoEditor />
    </div>
  );
}
