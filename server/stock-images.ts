// Stock Images Catalog and Selection System
// This module handles the selection of appropriate stock images for course covers
// Supports multiple image formats: .svg, .jpg, .jpeg, .png, .webp

import fs from 'fs';
import path from 'path';

export interface StockImage {
  id: string;
  filename: string;
  category: string;
  keywords: string[];
  description: string;
  url: string; // Local path or URL
  aspectRatio: string;
  width: number;
  height: number;
  format: string; // Image format (svg, jpg, png, etc.)
}

// Supported image formats
const SUPPORTED_FORMATS = ['.svg', '.jpg', '.jpeg', '.png', '.webp'];

// Base path for stock images
const STOCK_IMAGES_BASE_PATH = '/assets/stock-images';
const STOCK_IMAGES_DIR = path.join(process.cwd(), 'client', 'public', 'assets', 'stock-images');

// Image metadata mapping for auto-detected images
const imageMetadata: Record<string, { keywords: string[]; description: string }> = {
  // Technology images
  'coding-laptop': {
    keywords: ['programming', 'coding', 'software', 'development', 'computer', 'technology', 'web', 'app', 'digital'],
    description: 'Modern laptop with code on screen, ideal for programming and software development courses'
  },
  'data-visualization': {
    keywords: ['data', 'analytics', 'visualization', 'dashboard', 'charts', 'statistics', 'business intelligence'],
    description: 'Data visualization dashboard, perfect for data science and analytics courses'
  },
  'mobile-devices': {
    keywords: ['mobile', 'smartphone', 'app', 'ui', 'ux', 'design', 'interface', 'digital'],
    description: 'Mobile devices and apps, suitable for mobile development and UX/UI courses'
  },

  // Business images
  'meeting-collaboration': {
    keywords: ['business', 'meeting', 'collaboration', 'teamwork', 'office', 'professional', 'corporate', 'strategy'],
    description: 'Professional business meeting, ideal for management and business strategy courses'
  },
  'finance-charts': {
    keywords: ['finance', 'charts', 'graphs', 'economics', 'money', 'investment', 'financial', 'analysis'],
    description: 'Financial charts and analysis, perfect for finance and economics courses'
  },
  'handshake-partnership': {
    keywords: ['handshake', 'partnership', 'deal', 'agreement', 'business', 'professional', 'success', 'cooperation'],
    description: 'Business handshake representing partnerships and agreements'
  },

  // Science images
  'laboratory-research': {
    keywords: ['laboratory', 'research', 'science', 'chemistry', 'biology', 'experiment', 'medical', 'discovery'],
    description: 'Modern laboratory setting, ideal for scientific and medical courses'
  },
  'dna-molecular': {
    keywords: ['dna', 'molecular', 'genetics', 'biology', 'biotechnology', 'medicine', 'research', 'structure'],
    description: 'DNA molecular structure visualization, perfect for biology and genetics courses'
  },
  'space-astronomy': {
    keywords: ['space', 'astronomy', 'planet', 'universe', 'cosmos', 'physics', 'celestial', 'exploration'],
    description: 'Space and celestial bodies, suitable for astronomy and physics courses'
  },

  // Arts images
  'creative-design': {
    keywords: ['art', 'design', 'creative', 'painting', 'artistic', 'creativity', 'visual', 'expression'],
    description: 'Creative art supplies and design elements, ideal for art and design courses'
  },
  'music-instruments': {
    keywords: ['music', 'instruments', 'piano', 'melody', 'composition', 'audio', 'performance', 'sound'],
    description: 'Musical instruments and composition, perfect for music theory and performance courses'
  },
  'photography-camera': {
    keywords: ['photography', 'camera', 'lens', 'visual', 'artistic', 'creative', 'image', 'composition', 'photo', 'photographer', 'digital photography', 'portrait', 'landscape'],
    description: 'Professional camera and photography equipment'
  },

  // Education images
  'books-learning': {
    keywords: ['education', 'books', 'learning', 'study', 'knowledge', 'academic', 'reading', 'library'],
    description: 'Stack of educational books, representing learning and knowledge acquisition'
  },
  'classroom-teaching': {
    keywords: ['classroom', 'teaching', 'education', 'learning', 'students', 'instruction', 'academic', 'school'],
    description: 'Modern classroom environment, ideal for teaching and educational courses'
  },
  'graduation-success': {
    keywords: ['graduation', 'success', 'achievement', 'diploma', 'education', 'accomplishment', 'learning', 'degree'],
    description: 'Graduation cap and diploma, representing educational achievement'
  },

  // General images
  'abstract-geometric': {
    keywords: ['abstract', 'geometric', 'modern', 'clean', 'professional', 'design', 'pattern'],
    description: 'Abstract geometric pattern, suitable for any course topic'
  },
  'nature-growth': {
    keywords: ['nature', 'growth', 'development', 'progress', 'organic', 'natural', 'evolution'],
    description: 'Nature and growth concept, representing learning and development'
  },
  'light-innovation': {
    keywords: ['light', 'innovation', 'idea', 'inspiration', 'creativity', 'bright', 'concept'],
    description: 'Light and innovation concept, perfect for courses about new ideas and creativity'
  },

  // Custom technology images
  'Cyber Security': {
    keywords: ['cyber', 'security', 'cybersecurity', 'information security', 'network security', 'hacking', 'privacy', 'protection', 'firewall', 'encryption', 'malware', 'threat', 'vulnerability'],
    description: 'Cyber security and information protection for security courses'
  },
  'Blockchain': {
    keywords: ['blockchain', 'cryptocurrency', 'bitcoin', 'distributed ledger', 'smart contracts', 'decentralized', 'crypto', 'web3'],
    description: 'Blockchain technology and cryptocurrency concepts'
  },
  'Dev Ops': {
    keywords: ['devops', 'deployment', 'continuous integration', 'ci/cd', 'automation', 'infrastructure', 'docker', 'kubernetes', 'cloud'],
    description: 'DevOps practices and deployment automation'
  },
  'LLM': {
    keywords: ['llm', 'large language model', 'ai', 'artificial intelligence', 'machine learning', 'natural language processing', 'nlp', 'gpt', 'chatbot'],
    description: 'Large Language Models and AI technology'
  },
  'Quantum Computing': {
    keywords: ['quantum', 'computing', 'quantum computer', 'quantum mechanics', 'qubits', 'quantum algorithm', 'physics', 'advanced computing'],
    description: 'Quantum computing and advanced computational methods'
  },
  'eCommerce': {
    keywords: ['ecommerce', 'e-commerce', 'online store', 'shopping', 'retail', 'business', 'marketplace', 'digital commerce', 'online business'],
    description: 'E-commerce and online business platforms'
  },
  'eCommerce2': {
    keywords: ['ecommerce', 'e-commerce', 'online store', 'shopping', 'retail', 'business', 'marketplace', 'digital commerce', 'online business'],
    description: 'E-commerce and online business platforms (alternative)'
  },

  // Additional custom technology images
  'AI': {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'neural networks', 'deep learning', 'automation', 'intelligence', 'algorithms'],
    description: 'Artificial Intelligence and machine learning concepts'
  },
  'AWS Cloud': {
    keywords: ['aws', 'cloud', 'amazon web services', 'cloud computing', 'infrastructure', 'serverless', 'ec2', 's3', 'devops'],
    description: 'AWS Cloud computing and infrastructure'
  },
  'AWS Cloud2': {
    keywords: ['aws', 'cloud', 'amazon web services', 'cloud computing', 'infrastructure', 'serverless', 'ec2', 's3', 'devops'],
    description: 'AWS Cloud computing and infrastructure (alternative)'
  },
  'DIGITAL MEDIA 2': {
    keywords: ['digital media', 'content creation', 'multimedia', 'graphics', 'video', 'audio', 'media production', 'creative'],
    description: 'Digital media and content creation'
  },
  'Digital Marketing and AI': {
    keywords: ['digital marketing', 'ai marketing', 'automation', 'seo', 'social media', 'advertising', 'analytics', 'online marketing'],
    description: 'Digital marketing with AI integration'
  },
  'HR': {
    keywords: ['hr', 'human resources', 'management', 'recruitment', 'employee', 'workforce', 'talent', 'people management'],
    description: 'Human Resources and people management'
  },
  'Java1': {
    keywords: ['java', 'programming', 'coding', 'object oriented', 'enterprise', 'spring', 'development', 'software'],
    description: 'Java programming and development'
  },
  'Java2': {
    keywords: ['java', 'programming', 'coding', 'object oriented', 'enterprise', 'spring', 'development', 'software'],
    description: 'Java programming and development (alternative)'
  },
  'LLM2': {
    keywords: ['llm', 'large language model', 'ai', 'artificial intelligence', 'machine learning', 'natural language processing', 'nlp', 'gpt', 'chatbot'],
    description: 'Large Language Models and AI technology (alternative)'
  },
  'LLM3': {
    keywords: ['llm', 'large language model', 'ai', 'artificial intelligence', 'machine learning', 'natural language processing', 'nlp', 'gpt', 'chatbot'],
    description: 'Large Language Models and AI technology (third option)'
  },
  'LangChain': {
    keywords: ['langchain', 'ai', 'language models', 'chains', 'prompt engineering', 'llm', 'artificial intelligence', 'automation'],
    description: 'LangChain framework for AI applications'
  },
  'Machine Learning': {
    keywords: ['machine learning', 'ml', 'ai', 'artificial intelligence', 'data science', 'algorithms', 'neural networks', 'training'],
    description: 'Machine Learning algorithms and models'
  },
  'Machine Learning2': {
    keywords: ['machine learning', 'ml', 'ai', 'artificial intelligence', 'data science', 'algorithms', 'neural networks', 'training'],
    description: 'Machine Learning algorithms and models (alternative)'
  },
  'Python': {
    keywords: ['python', 'programming', 'coding', 'scripting', 'data science', 'web development', 'automation', 'django', 'flask'],
    description: 'Python programming language and development'
  },
  'Python2': {
    keywords: ['python', 'programming', 'coding', 'scripting', 'data science', 'web development', 'automation', 'django', 'flask'],
    description: 'Python programming language and development (alternative)'
  },
  'Quantum Computing 2': {
    keywords: ['quantum', 'computing', 'quantum computer', 'quantum mechanics', 'qubits', 'quantum algorithm', 'physics', 'advanced computing'],
    description: 'Quantum computing and advanced computational methods (alternative)'
  },
  'Typescript': {
    keywords: ['typescript', 'javascript', 'web development', 'frontend', 'backend', 'node', 'angular', 'react', 'programming'],
    description: 'TypeScript programming and web development'
  },
  'Typescript2': {
    keywords: ['typescript', 'javascript', 'web development', 'frontend', 'backend', 'node', 'angular', 'react', 'programming'],
    description: 'TypeScript programming and web development (alternative)'
  },
  'business analytics': {
    keywords: ['business analytics', 'data analysis', 'business intelligence', 'reporting', 'kpi', 'metrics', 'dashboard', 'insights'],
    description: 'Business analytics and data-driven insights'
  },
  'entreprenuership': {
    keywords: ['entrepreneurship', 'startup', 'business', 'innovation', 'venture', 'founder', 'small business', 'leadership'],
    description: 'Entrepreneurship and startup business'
  },
  'entreprenuership 2': {
    keywords: ['entrepreneurship', 'startup', 'business', 'innovation', 'venture', 'founder', 'small business', 'leadership'],
    description: 'Entrepreneurship and startup business (alternative)'
  }
};

/**
 * Auto-detect images from the file system and create catalog
 */
function detectStockImages(): StockImage[] {
  const images: StockImage[] = [];
  
  if (!fs.existsSync(STOCK_IMAGES_DIR)) {
    console.warn('Stock images directory not found:', STOCK_IMAGES_DIR);
    return images;
  }

  try {
    // Read all category directories
    const categories = fs.readdirSync(STOCK_IMAGES_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    let imageIdCounter = 1;

    for (const category of categories) {
      const categoryPath = path.join(STOCK_IMAGES_DIR, category);
      
      // Read all files in category directory
      const files = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name)
        .filter(filename => {
          const ext = path.extname(filename).toLowerCase();
          return SUPPORTED_FORMATS.includes(ext);
        });

      for (const filename of files) {
        const ext = path.extname(filename).toLowerCase();
        const baseName = path.basename(filename, ext);
        
        // Get metadata for this image, or use defaults
        const metadata = imageMetadata[baseName] || {
          keywords: [category, 'education', 'learning'],
          description: `${category} image for educational courses`
        };

        const image: StockImage = {
          id: `${category.substring(0, 3)}-${imageIdCounter.toString().padStart(2, '0')}`,
          filename: filename,
          category: category,
          keywords: metadata.keywords,
          description: metadata.description,
          url: `${STOCK_IMAGES_BASE_PATH}/${category}/${filename}`,
          aspectRatio: '16:9',
          width: 800,
          height: 450,
          format: ext.substring(1) // Remove the dot
        };

        images.push(image);
        imageIdCounter++;
      }
    }
  } catch (error) {
    console.error('Error detecting stock images:', error);
  }

  return images;
}

// Auto-generated stock image catalog
let stockImageCatalog: StockImage[] = [];

// Initialize catalog on module load
function initializeStockImageCatalog() {
  stockImageCatalog = detectStockImages();
  console.log(`📸 Loaded ${stockImageCatalog.length} stock images from file system`);
  
  // Log detected images by category
  const categoryCounts: Record<string, number> = {};
  stockImageCatalog.forEach(img => {
    categoryCounts[img.category] = (categoryCounts[img.category] || 0) + 1;
  });
  
  Object.entries(categoryCounts).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count} images`);
  });
}

// Initialize on first import
initializeStockImageCatalog();

/**
 * Get the current stock image catalog (re-scan if needed)
 */
export function getStockImageCatalog(): StockImage[] {
  if (stockImageCatalog.length === 0) {
    initializeStockImageCatalog();
  }
  return stockImageCatalog;
}

/**
 * Refresh the catalog by re-scanning the file system
 */
export function refreshStockImageCatalog(): StockImage[] {
  initializeStockImageCatalog();
  return stockImageCatalog;
}

/**
 * Select the most appropriate stock image based on course topic and title
 */
export function selectStockImage(courseTitle: string, courseTopic?: string): StockImage {
  const catalog = getStockImageCatalog();
  
  if (catalog.length === 0) {
    throw new Error('No stock images found. Please add images to the stock-images directory.');
  }
  
  const searchText = `${courseTitle} ${courseTopic || ''}`.toLowerCase();
  console.log(`\n🔍 Selecting image for: "${courseTitle}"`);
  console.log(`📝 Search text: "${searchText}"`);
  console.log(`📁 Available images: ${catalog.length}`);
  
  // Score each image based on keyword matches
  const scoredImages = catalog.map(image => {
    let score = 0;
    const matchedKeywords: string[] = [];
    
    // Check for keyword matches in the search text
    for (const keyword of image.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // Give higher scores to more specific keywords
        const points = keyword.length > 6 ? 3 : 2;
        score += points;
        matchedKeywords.push(`${keyword}(${points})`);
      }
    }
    
    // Bonus points for exact category matches
    if (searchText.includes(image.category)) {
      score += 5;
      matchedKeywords.push(`category:${image.category}(5)`);
    }
    
    // Log top scoring images
    if (score > 0) {
      console.log(`🎯 ${image.filename}: ${score} points [${matchedKeywords.join(', ')}]`);
    }
    
    return { image, score };
  });
  
  // Sort by score (highest first)
  scoredImages.sort((a, b) => b.score - a.score);
  
  // If no matches found, return a general image
  if (scoredImages[0].score === 0) {
    const generalImages = catalog.filter(img => img.category === 'general');
    if (generalImages.length > 0) {
      return generalImages[Math.floor(Math.random() * generalImages.length)];
    }
    // If no general images, return any random image
    return catalog[Math.floor(Math.random() * catalog.length)];
  }
  
  // Return the best match, or randomly select from top matches if there are ties
  const topScore = scoredImages[0].score;
  const topMatches = scoredImages.filter(item => item.score === topScore);
  const selectedMatch = topMatches[Math.floor(Math.random() * topMatches.length)];
  
  console.log(`\n✅ Selected: ${selectedMatch.image.filename} with ${topScore} points`);
  if (topMatches.length > 1) {
    console.log(`🎲 Random selection from ${topMatches.length} tied images`);
  }
  
  return selectedMatch.image;
}

/**
 * Get all images in a specific category
 */
export function getImagesByCategory(category: string): StockImage[] {
  const catalog = getStockImageCatalog();
  return catalog.filter(image => image.category === category);
}

/**
 * Get a random image from a specific category
 */
export function getRandomImageFromCategory(category: string): StockImage | null {
  const categoryImages = getImagesByCategory(category);
  if (categoryImages.length === 0) return null;
  
  return categoryImages[Math.floor(Math.random() * categoryImages.length)];
}

/**
 * Get all available categories
 */
export function getAvailableCategories(): string[] {
  const catalog = getStockImageCatalog();
  return [...new Set(catalog.map(image => image.category))];
}

/**
 * Search images by keywords
 */
export function searchImagesByKeywords(keywords: string[]): StockImage[] {
  const catalog = getStockImageCatalog();
  return catalog.filter(image => 
    keywords.some(keyword => 
      image.keywords.some(imgKeyword => 
        imgKeyword.toLowerCase().includes(keyword.toLowerCase())
      )
    )
  );
}

/**
 * Add metadata for new images (can be called to register metadata for custom images)
 */
export function addImageMetadata(imageName: string, metadata: { keywords: string[]; description: string }) {
  imageMetadata[imageName] = metadata;
  // Refresh catalog to pick up the new metadata
  refreshStockImageCatalog();
}
