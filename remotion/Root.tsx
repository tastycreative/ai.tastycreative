import { Composition } from "remotion";
import { VideoToGif, VideoToGifSchema } from "./compositions/VideoToGif";
import { ClipEditor, ClipEditorSchema } from "./compositions/ClipEditor";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoToGif"
        component={VideoToGif}
        durationInFrames={150}
        fps={30}
        width={1200}
        height={1600}
        schema={VideoToGifSchema}
        defaultProps={{
          videoSrc: "",
          fullBlurIntensity: 0,
          blurRegions: [],
          regionBlurIntensity: 10,
          trimStartFrame: 0,
          trimEndFrame: 150,
        }}
      />
      <Composition
        id="ClipEditor"
        component={ClipEditor}
        durationInFrames={300}
        fps={30}
        width={1200}
        height={1600}
        schema={ClipEditorSchema}
        defaultProps={{
          clips: [],
          transitions: [],
          overlays: [],
          activeCollageLayout: null,
        }}
      />
    </>
  );
};
