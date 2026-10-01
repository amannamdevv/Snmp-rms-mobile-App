import { Dimensions, PixelRatio, Platform } from 'react-native';

let SCREEN_WIDTH = 375;
let SCREEN_HEIGHT = 812;
try {
  const dims = Dimensions.get('window');
  if (dims && typeof dims.width === 'number') {
    SCREEN_WIDTH = dims.width;
    SCREEN_HEIGHT = dims.height;
  }
} catch (_) {
  // Runtime not ready — use safe defaults
}

// Standard mobile device size (iPhone 11 as a baseline)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales a dimension based on the screen width.
 * Best for width, padding, margin, icon size.
 */
const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales a dimension based on the screen height.
 * Best for height.
 */
const verticalScale = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Scales a dimension moderately. 
 * Factor 0.5 means it scales but not as aggressively as scale().
 * Best for font size, padding, margin.
 */
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Specifically for font size to ensure readability across all devices.
 */
const responsiveFontSize = (size: number) => {
  const newSize = moderateScale(size);
  // Optional: Add PixelRatio adjustment for higher precision if needed
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export { 
  scale, 
  verticalScale, 
  moderateScale, 
  responsiveFontSize, 
  SCREEN_WIDTH, 
  SCREEN_HEIGHT 
};
