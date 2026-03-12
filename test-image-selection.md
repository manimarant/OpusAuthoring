# Testing Custom Images in Technology Folder

## Quick Test Steps

### 1. Add Test Images
```bash
# Add these to: client/public/assets/stock-images/technology/
- my-python-course.jpg
- javascript-basics.png 
- web-development.webp
```

### 2. Check Current Catalog
```bash
# GET request to see what's detected:
curl http://localhost:5000/api/stock-images

# Look for your new images in the response:
{
  "total": 21,  // Should increase
  "images": [...],
  "categories": ["technology", "business", ...],
  "formats": ["svg", "jpg", "png", "webp"]  // Should include your formats
}
```

### 3. Test Course Scenarios

#### Scenario A: Python Course
```bash
# Create course with title: "Python Programming Fundamentals"
# Topic: "Programming"
# Expected: Should select "my-python-course.jpg" if it has python keywords

POST /api/courses/YOUR_COURSE_ID/generate-cover-image
# Response should return: "/assets/stock-images/technology/my-python-course.jpg"
```

#### Scenario B: JavaScript Course  
```bash
# Create course with title: "JavaScript Web Development"
# Topic: "Web Development"
# Expected: Should select "javascript-basics.png" if it has JS keywords

POST /api/courses/YOUR_COURSE_ID/generate-cover-image
# Response should return: "/assets/stock-images/technology/javascript-basics.png"
```

## Selection Priority Examples

### High-Scoring Match:
- **Course**: "React Frontend Development"
- **Image**: `react-components.png` with keywords: `['react', 'components', 'frontend']`
- **Score**: 6+ points (3 points × 2 keyword matches)

### Category Bonus Match:
- **Course**: "Introduction to Technology"
- **Image**: Any image in `technology/` folder
- **Score**: 5+ points (category bonus)

### Default Match:
- **Course**: "Generic Course Title"  
- **Image**: Random selection from `general/` folder
- **Score**: 0 points (fallback)

## Debugging Selection

### Check What Was Selected:
```bash
# The generate-cover-image response shows selection details:
{
  "imageUrl": "/assets/stock-images/technology/your-image.jpg",
  "imageInfo": {
    "id": "tec-04",
    "description": "Your image description", 
    "category": "technology",
    "keywords": ["your", "keywords"]
  }
}
```

### View Server Logs:
```bash
# Server logs show the scoring process:
📸 Loaded 21 stock images from file system
  - technology: 6 images
  - business: 3 images
  - science: 3 images
  ...

✅ Selected stock image for course "Python Programming": Python for data science and analytics
```