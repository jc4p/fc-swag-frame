import * as frame from '@farcaster/frame-sdk'

export async function initializeFrame() {
  const context = await frame.sdk.context;

  // The SDK might return the user object nested, handle that case
  let user = context?.user;
  if (user?.user) {
    user = user.user;
  }

  if (!user || !user.fid) {
    console.log('Not running inside a Farcaster Frame or user context unavailable.');
    // Decide if you want to call ready() even outside a frame,
    // might be useful if you have a loading state independent of the frame.
    // await frame.sdk.actions.ready();
    return;
  }

  console.log('Frame Context Initialized. User FID:', user.fid);
  // Make FID available globally for other components if needed, though passing props is generally preferred
  window.userFid = user.fid;

  // Signal to the Frame environment that the app is ready to be displayed
  await frame.sdk.actions.ready();
}

export async function openUrl(url) {
  try {
    await frame.sdk.actions.openUrl({ url });
  } catch (error) {
    await frame.sdk.actions.openUrl(url);
  }
} 