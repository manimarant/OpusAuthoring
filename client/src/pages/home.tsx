import { Link } from "wouter";
import { Brain, Puzzle, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import step1Image from "@assets/stock_images/person_planning_cour_cd45555e.jpg";
import step2Image from "@assets/stock_images/organizing_documents_33f8c61f.jpg";
import step3Image from "@assets/stock_images/building_framework_s_d1ea1483.jpg";
import step4Image from "@assets/stock_images/creative_content_cre_b720a13e.jpg";
import step5Image from "@assets/stock_images/learning_goals_objec_6b786dac.jpg";
import step6Image from "@assets/stock_images/sharing_publishing_c_e294f701.jpg";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Background */}
      <div className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-12 mb-8">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-light text-foreground mb-6" data-testid="text-hero-title">
                Build structured courses with AI and publish them for LMS delivery
              </h1>
              <p className="text-xl md:text-2xl font-light text-muted-foreground max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
                oPuslearn helps teams generate outlines, author lessons, add media and assessments, and export courses as SCORM packages or LTI-ready experiences.
              </p>
            </div>
          </div>
          <div className="text-center">
            <Link href="/course-setup" data-testid="link-create-course">
              <Button size="lg" variant="ai" className="text-lg px-8 py-4 shadow-lg" data-testid="button-create-course">
                <Sparkles className="mr-2 h-6 w-6" />
                Generate Your First Course
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Process Steps */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Step 1 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-1">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-1">
                1
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-1-title">
                Define the course brief
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-1-description">
              Start with a title, topic, audience, and learning objectives. oPuslearn uses that brief to create the initial course direction before content generation begins.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-1-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>AI-assisted course title and objective generation</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Target audience and learning objective capture</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Draft course metadata for consistent authoring</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Duration and difficulty setup for the course shell</span>
              </li>
            </ul>
          </div>
          <div className="overflow-hidden h-full min-h-96" data-testid="image-step-1">
            <img 
              src={step1Image} 
              alt="Author defining a course brief with title, audience, and learning objectives in oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Step 2 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-2">
          <div className="overflow-hidden h-full min-h-96 md:order-first" data-testid="image-step-2">
            <img 
              src={step2Image} 
              alt="Source documents being organized for upload and AI-assisted course generation in oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-2">
                2
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-2-title">
                Import source content
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-2-description">
              Upload documents such as PDF, DOCX, PPTX, and text files. oPuslearn extracts the material and uses it as source context for AI-assisted course creation.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-2-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Reference file upload with text extraction</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>AI-generated course setup from uploaded material</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Centralized source material for authors and editors</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Support for course creation from notes and documents</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 3 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-3">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-3">
                3
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-3-title">
                Generate the course structure
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-3-description">
              Create top-level modules and chapter-level lessons. The application organizes the course into a navigable structure that can be edited as the outline evolves.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-3-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Module and chapter hierarchy for each course</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Editable outline created from AI or manual setup</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Ordered lesson flow across modules and chapters</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Flexible structure for traditional or chapter-based courses</span>
              </li>
            </ul>
          </div>
          <div className="overflow-hidden h-full min-h-96" data-testid="image-step-3">
            <img 
              src={step3Image} 
              alt="Course modules and chapters being structured into an editable outline in oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Step 4 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-4">
          <div className="overflow-hidden h-full min-h-96 md:order-first" data-testid="image-step-4">
            <img 
              src={step4Image} 
              alt="Lesson content being authored with structured content blocks inside oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-4">
                4
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-4-title">
                Author lesson content
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-4-description">
              Use the lesson editor to build chapter content with text, headings, lists, statements, quotes, images, quizzes, and assignments inside each module.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-4-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Block-based lesson editor for structured content</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Rich text and instructional content blocks</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Per-chapter editing with ordered content blocks</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Course navigation built around real lesson pages</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 5 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-5">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-5">
                5
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-5-title">
                Add AI, media, and assessments
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-5-description">
              Generate lesson text, quiz questions, assignments, images, and narration with AI, or upload your own resources to build a richer learner experience.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-5-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>AI text, AI quiz, AI assignment, and AI image generation</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Uploaded images, audio, video, and document resources</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Quiz and assignment blocks inside lesson pages</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Cover image generation and chapter illustration support</span>
              </li>
            </ul>
          </div>
          <div className="overflow-hidden h-full min-h-96" data-testid="image-step-5">
            <img 
              src={step5Image} 
              alt="AI-generated media, quizzes, and assignments being added to a lesson in oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Step 6 */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-20" data-testid="section-step-6">
          <div className="overflow-hidden h-full min-h-96 md:order-first" data-testid="image-step-6">
            <img 
              src={step6Image} 
              alt="Finished course being prepared for SCORM export and MoodleCloud LTI publishing from oPuslearn" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-light text-xl" data-testid="number-step-6">
                6
              </div>
              <h2 className="text-3xl font-light text-foreground" data-testid="text-step-6-title">
                Publish to your LMS
              </h2>
            </div>
            <p className="text-lg font-light text-muted-foreground" data-testid="text-step-6-description">
              Export the finished course for delivery. oPuslearn supports SCORM packaging and LTI 1.3 setup so courses can be launched from platforms like MoodleCloud.
            </p>
            <ul className="space-y-3 text-muted-foreground" data-testid="list-step-6-features">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>SCORM package export for LMS upload</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>LTI 1.3 manual setup and MoodleCloud registration flow</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Browser-based course preview before publishing</span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0"></div>
                <span>Responsive course delivery from generated lesson pages</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Intelligence Behind Process Section */}
        <div className="bg-white rounded-2xl p-12 mt-20" data-testid="section-intelligence">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-light text-foreground mb-4" data-testid="text-intelligence-title">
              What oPuslearn actually helps you do
            </h2>
            <p className="text-xl font-light text-muted-foreground" data-testid="text-intelligence-description">
              It combines AI-assisted authoring with practical publishing workflows for teams building LMS-ready training content.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4" data-testid="feature-ai-intelligence">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light text-foreground" data-testid="text-ai-intelligence-title">
                AI-Assisted Authoring
              </h3>
              <p className="font-light text-muted-foreground" data-testid="text-ai-intelligence-description">
                Generate course outlines, lesson text, quizzes, assignments, images, and narration from a course brief or uploaded source material.
              </p>
            </div>
            
            <div className="text-center space-y-4" data-testid="feature-accessibility">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto">
                <Puzzle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light text-foreground" data-testid="text-accessibility-title">
                Structured Course Editing
              </h3>
              <p className="font-light text-muted-foreground" data-testid="text-accessibility-description">
                Build courses with modules, chapters, and reusable content blocks, then refine each lesson with media, assessments, and instructional copy.
              </p>
            </div>
            
            <div className="text-center space-y-4" data-testid="feature-instructional-design">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light text-foreground" data-testid="text-instructional-design-title">
                LMS Publishing
              </h3>
              <p className="font-light text-muted-foreground" data-testid="text-instructional-design-description">
                Deliver finished content through SCORM export or LTI 1.3 integration, including MoodleCloud-compatible publishing paths.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
