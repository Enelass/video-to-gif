// Import required modules
const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// DOM Elements
const dropArea = document.getElementById('drop-area');
const selectFileBtn = document.getElementById('select-file-btn');
const conversionPanel = document.getElementById('conversion-panel');
const resultPanel = document.getElementById('result-panel');
const errorPanel = document.getElementById('error-panel');
const cancelBtn = document.getElementById('cancel-btn');
const newConversionBtn = document.getElementById('new-conversion-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const videoPreview = document.getElementById('video-preview');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const fileDuration = document.getElementById('file-duration');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const consoleContent = document.getElementById('console-content');
const toggleConsole = document.getElementById('toggle-console');
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Comparison tab elements
const originalPreview = document.getElementById('original-preview');
const originalSizeEl = document.getElementById('original-size');
const originalDimensions = document.getElementById('original-dimensions');
const originalBar = document.getElementById('original-bar');
const originalSizeChart = document.getElementById('original-size-chart');

// Tiny version elements
const tinyPreview = document.getElementById('tiny-preview');
const tinyPreviewLarge = document.getElementById('tiny-preview-large');
const tinySize = document.getElementById('tiny-size');
const tinyReduction = document.getElementById('tiny-reduction');
const tinyDimensions = document.getElementById('tiny-dimensions');
const tinyBar = document.getElementById('tiny-bar');
const tinySizeChart = document.getElementById('tiny-size-chart');
const originalSizeTiny = document.getElementById('original-size-tiny');
const tinySizeDetail = document.getElementById('tiny-size-detail');
const tinyReductionDetail = document.getElementById('tiny-reduction-detail');
const tinyDimensionsDetail = document.getElementById('tiny-dimensions-detail');
const tinyFps = document.getElementById('tiny-fps');
const tinyColorDepth = document.getElementById('tiny-color-depth');
const tinyDitherMethod = document.getElementById('tiny-dither-method');
const tinyPath = document.getElementById('tiny-path');
const openTinyBtn = document.getElementById('open-tiny-btn');
const openTinyFolderBtn = document.getElementById('open-tiny-folder-btn');

// Small version elements
const smallPreview = document.getElementById('small-preview');
const smallPreviewLarge = document.getElementById('small-preview-large');
const smallSize = document.getElementById('small-size');
const smallReduction = document.getElementById('small-reduction');
const smallDimensions = document.getElementById('small-dimensions');
const smallBar = document.getElementById('small-bar');
const smallSizeChart = document.getElementById('small-size-chart');
const originalSizeSmall = document.getElementById('original-size-small');
const smallSizeDetail = document.getElementById('small-size-detail');
const smallReductionDetail = document.getElementById('small-reduction-detail');
const smallDimensionsDetail = document.getElementById('small-dimensions-detail');
const smallFps = document.getElementById('small-fps');
const smallColorDepth = document.getElementById('small-color-depth');
const smallDitherMethod = document.getElementById('small-dither-method');
const smallPath = document.getElementById('small-path');
const openSmallBtn = document.getElementById('open-small-btn');
const openSmallFolderBtn = document.getElementById('open-small-folder-btn');

// Medium version elements
const mediumPreview = document.getElementById('medium-preview');
const mediumPreviewLarge = document.getElementById('medium-preview-large');
const mediumSize = document.getElementById('medium-size');
const mediumReduction = document.getElementById('medium-reduction');
const mediumDimensions = document.getElementById('medium-dimensions');
const mediumBar = document.getElementById('medium-bar');
const mediumSizeChart = document.getElementById('medium-size-chart');
const originalSizeMedium = document.getElementById('original-size-medium');
const mediumSizeDetail = document.getElementById('medium-size-detail');
const mediumReductionDetail = document.getElementById('medium-reduction-detail');
const mediumDimensionsDetail = document.getElementById('medium-dimensions-detail');
const mediumFps = document.getElementById('medium-fps');
const mediumColorDepth = document.getElementById('medium-color-depth');
const mediumDitherMethod = document.getElementById('medium-dither-method');
const mediumPath = document.getElementById('medium-path');
const openMediumBtn = document.getElementById('open-medium-btn');
const openMediumFolderBtn = document.getElementById('open-medium-folder-btn');

// Global variables
let currentVideoPath = null;
let currentGifVersions = {
  tiny: null,
  small: null,
  medium: null
};
let conversionProcess = null;
let currentVersion = null;

// Event listeners for drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
  dropArea.classList.add('active');
}

function unhighlight() {
  dropArea.classList.remove('active');
}

// Handle file drop
dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 0) {
    handleFile(files[0].path);
  }
}

// Handle file selection via button
selectFileBtn.addEventListener('click', async () => {
  const filePath = await ipcRenderer.invoke('open-file-dialog');
  if (filePath) {
    handleFile(filePath);
  }
});

// Handle the selected file
function handleFile(filePath) {
  // Check if it's a video file
  const supportedExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg'];
  const ext = path.extname(filePath).toLowerCase();
  
  if (!supportedExtensions.includes(ext)) {
    showError('Unsupported file type', `The file you selected (${ext}) is not a supported video format. Please select a video file.`);
    return;
  }
  
  currentVideoPath = filePath;
  
  // Show conversion panel
  dropArea.classList.add('hidden');
  conversionPanel.classList.remove('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');
  
  // Update file info
  fileName.textContent = path.basename(filePath);
  const stats = fs.statSync(filePath);
  fileSize.textContent = formatSize(stats.size);
  
  // Load video preview
  videoPreview.src = filePath;
  videoPreview.onloadedmetadata = () => {
    fileDuration.textContent = formatDuration(videoPreview.duration);
  };
  
  // Clear console
  consoleContent.textContent = '';
  
  // Start conversion
  startConversion(filePath);
}

// Format file size
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Format duration
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Start the conversion process
function startConversion(videoPath) {
  // Reset progress
  progressFill.style.width = '0%';
  progressText.textContent = 'Processing...';
  
  // Send to main process
  ipcRenderer.send('convert-video', videoPath);
}

// Listen for conversion progress
ipcRenderer.on('conversion-progress', (event, data) => {
  // Update console output
  consoleContent.textContent += data.data;
  consoleContent.scrollTop = consoleContent.scrollHeight;
  
  // Update progress based on output
  updateProgressFromOutput(data.data);
});

// Update progress based on ffmpeg output
function updateProgressFromOutput(output) {
  // Look for frame=X patterns to estimate progress
  const frameMatch = output.match(/frame=\s*(\d+)/);
  if (frameMatch) {
    const frame = parseInt(frameMatch[1]);
    // Assuming average video is around 180 frames (60 seconds at 3 fps)
    const estimatedProgress = Math.min(Math.round((frame / 180) * 100), 95);
    progressFill.style.width = `${estimatedProgress}%`;
    
    // Show which version is being processed
    if (currentVersion) {
      progressText.textContent = `Processing ${currentVersion} version... ${estimatedProgress}%`;
    } else {
      progressText.textContent = `Processing... ${estimatedProgress}%`;
    }
  }
}

// Listen for version updates
ipcRenderer.on('conversion-version', (event, data) => {
  currentVersion = data.version;
  progressText.textContent = `Processing ${currentVersion} version...`;
  
  // Reset progress for new version
  progressFill.style.width = '0%';
});

// Listen for conversion complete
ipcRenderer.on('conversion-complete', (event, result) => {
  if (result.success) {
    // Store paths to GIF versions
    currentGifVersions = {
      tiny: result.versions.tiny.path,
      small: result.versions.small.path,
      medium: result.versions.medium.path
    };
    
    // Update progress
    progressFill.style.width = '100%';
    progressText.textContent = 'Conversion Complete!';
    
    // Show result panel
    setTimeout(() => {
      conversionPanel.classList.add('hidden');
      resultPanel.classList.remove('hidden');
      
      // Update original video info
      originalPreview.src = result.originalPath;
      originalSizeEl.textContent = formatSize(result.originalSize);
      originalSizeChart.textContent = formatSize(result.originalSize);
      originalDimensions.textContent = result.metadata.dimensions.original || 'N/A';
      
      // Set original size as 100% for the chart
      const maxSize = result.originalSize;
      
      // Update tiny version info
      tinyPreview.src = result.versions.tiny.path;
      tinyPreviewLarge.src = result.versions.tiny.path;
      tinySize.textContent = formatSize(result.versions.tiny.size);
      tinySizeDetail.textContent = formatSize(result.versions.tiny.size);
      tinyReduction.textContent = `${result.versions.tiny.reduction}%`;
      tinyReductionDetail.textContent = `${result.versions.tiny.reduction}%`;
      tinyDimensions.textContent = result.metadata.dimensions.tiny || 'N/A';
      tinyDimensionsDetail.textContent = result.metadata.dimensions.tiny || 'N/A';
      tinyFps.textContent = result.metadata.fps.tiny || 'N/A';
      tinyColorDepth.textContent = result.metadata.colorDepth.tiny ? `${result.metadata.colorDepth.tiny} colors` : 'N/A';
      tinyDitherMethod.textContent = result.metadata.ditherMethod.tiny || 'N/A';
      tinyPath.textContent = result.versions.tiny.path;
      originalSizeTiny.textContent = formatSize(result.originalSize);
      
      // Update small version info
      smallPreview.src = result.versions.small.path;
      smallPreviewLarge.src = result.versions.small.path;
      smallSize.textContent = formatSize(result.versions.small.size);
      smallSizeDetail.textContent = formatSize(result.versions.small.size);
      smallReduction.textContent = `${result.versions.small.reduction}%`;
      smallReductionDetail.textContent = `${result.versions.small.reduction}%`;
      smallDimensions.textContent = result.metadata.dimensions.small || 'N/A';
      smallDimensionsDetail.textContent = result.metadata.dimensions.small || 'N/A';
      smallFps.textContent = result.metadata.fps.small || 'N/A';
      smallColorDepth.textContent = result.metadata.colorDepth.small ? `${result.metadata.colorDepth.small} colors` : 'N/A';
      smallDitherMethod.textContent = result.metadata.ditherMethod.small || 'N/A';
      smallPath.textContent = result.versions.small.path;
      originalSizeSmall.textContent = formatSize(result.originalSize);
      
      // Update medium version info
      mediumPreview.src = result.versions.medium.path;
      mediumPreviewLarge.src = result.versions.medium.path;
      mediumSize.textContent = formatSize(result.versions.medium.size);
      mediumSizeDetail.textContent = formatSize(result.versions.medium.size);
      mediumReduction.textContent = `${result.versions.medium.reduction}%`;
      mediumReductionDetail.textContent = `${result.versions.medium.reduction}%`;
      mediumDimensions.textContent = result.metadata.dimensions.medium || 'N/A';
      mediumDimensionsDetail.textContent = result.metadata.dimensions.medium || 'N/A';
      mediumFps.textContent = result.metadata.fps.medium || 'N/A';
      mediumColorDepth.textContent = result.metadata.colorDepth.medium ? `${result.metadata.colorDepth.medium} colors` : 'N/A';
      mediumDitherMethod.textContent = result.metadata.ditherMethod.medium || 'N/A';
      mediumPath.textContent = result.versions.medium.path;
      originalSizeMedium.textContent = formatSize(result.originalSize);
      
      // Update chart bars with animation
      setTimeout(() => {
        tinyBar.style.width = `${(result.versions.tiny.size / maxSize) * 100}%`;
        smallBar.style.width = `${(result.versions.small.size / maxSize) * 100}%`;
        mediumBar.style.width = `${(result.versions.medium.size / maxSize) * 100}%`;
        tinySizeChart.textContent = formatSize(result.versions.tiny.size);
        smallSizeChart.textContent = formatSize(result.versions.small.size);
        mediumSizeChart.textContent = formatSize(result.versions.medium.size);
      }, 500);
    }, 1000);
  } else {
    showError('Conversion Failed', result.error);
  }
});

// Show error panel
function showError(title, details) {
  dropArea.classList.add('hidden');
  conversionPanel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.remove('hidden');
  
  errorMessage.textContent = title;
  errorDetails.textContent = details;
}

// Cancel button
cancelBtn.addEventListener('click', () => {
  // TODO: Implement cancellation of the conversion process
  resetUI();
});

// New conversion button
newConversionBtn.addEventListener('click', resetUI);

// Try again button
tryAgainBtn.addEventListener('click', resetUI);

// Reset UI to initial state
function resetUI() {
  dropArea.classList.remove('hidden');
  conversionPanel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');
  
  // Reset video preview
  videoPreview.src = '';
  
  // Reset progress
  progressFill.style.width = '0%';
  progressText.textContent = 'Processing...';
  
  // Clear console
  consoleContent.textContent = '';
  
  currentVideoPath = null;
}

// Toggle console visibility
toggleConsole.addEventListener('click', () => {
  consoleContent.classList.toggle('hidden');
});

// Tab switching
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    button.classList.add('active');
    const tabId = button.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// Open GIF buttons
openTinyBtn.addEventListener('click', () => {
  if (currentGifVersions.tiny) {
    shell.openPath(currentGifVersions.tiny);
  }
});

openSmallBtn.addEventListener('click', () => {
  if (currentGifVersions.small) {
    shell.openPath(currentGifVersions.small);
  }
});

openMediumBtn.addEventListener('click', () => {
  if (currentGifVersions.medium) {
    shell.openPath(currentGifVersions.medium);
  }
});

// Open folder buttons
openTinyFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.tiny) {
    shell.showItemInFolder(currentGifVersions.tiny);
  }
});

openSmallFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.small) {
    shell.showItemInFolder(currentGifVersions.small);
  }
});

openMediumFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.medium) {
    shell.showItemInFolder(currentGifVersions.medium);
  }
});

// Initialize the UI
document.addEventListener('DOMContentLoaded', () => {
  resetUI();
  
  // Set initial tab
  tabButtons[0].click();
});
