import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    textToImageEndpoint: process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID,
    imageToVideoEndpoint: process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID,
    styleTransferEndpoint: process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID,
    allVars: {
      hasTextToImage: !!process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID,
      hasImageToVideo: !!process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID,
      hasStyleTransfer: !!process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID,
    }
  });
}