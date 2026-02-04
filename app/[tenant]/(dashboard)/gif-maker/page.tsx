import { VideoEditor } from "@/components/gif-maker/VideoEditor";

export const metadata = {
  title: "GIF Maker",
  description: "Create GIFs with blur overlays, text, shapes, transitions, and more",
};

export default function GifMakerPage() {
  return <VideoEditor />;
}
