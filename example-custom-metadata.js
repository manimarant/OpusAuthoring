// Example: How to add metadata for your custom images
// Add this to the imageMetadata object in server/stock-images.ts

const imageMetadata = {
  // ... existing metadata ...
  
  // Your custom images:
  'javascript-tutorial': {
    keywords: ['javascript', 'js', 'programming', 'coding', 'web', 'frontend', 'tutorial', 'development'],
    description: 'JavaScript tutorial and coding examples'
  },
  'react-components': {
    keywords: ['react', 'components', 'javascript', 'jsx', 'frontend', 'ui', 'library', 'development'],
    description: 'React components and UI development'
  },
  'python-data-science': {
    keywords: ['python', 'data', 'science', 'analytics', 'machine learning', 'programming', 'numpy', 'pandas'],
    description: 'Python for data science and analytics'
  }
};

// Without metadata, images get default keywords: [category, 'education', 'learning']
// For technology folder: ['technology', 'education', 'learning']