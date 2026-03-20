// Script to create or rebuild a clean "Data Science" demo course with seeded content blocks.
//
// Usage:
//   node create-data-science-demo.js
//   COURSE_ID=<existing-course-id> node create-data-science-demo.js
//
// Optional:
//   OPUS_API_BASE=http://localhost:5000

const API_BASE = process.env.OPUS_API_BASE || "http://localhost:5000";
const COURSE_ID = process.env.COURSE_ID || "";

const DEMO_STRUCTURE = [
  {
    title: "Module 1: Data Science Foundations",
    description: "Build a shared understanding of the discipline, its roles, and its workflow.",
    chapters: [
      {
        title: "What Data Science Is and Why It Matters",
        description: "A clear orientation to the field, its value, and the mindset required for analytical work.",
        blocks: [
          {
            type: "heading",
            content: { text: "Welcome to Data Science" },
          },
          {
            type: "text",
            content: {
              text: "Data science combines statistical reasoning, computational methods, and domain understanding to turn raw data into actionable insight.",
              html: "<p>Data science combines statistical reasoning, computational methods, and domain understanding to turn raw data into actionable insight. In a university setting, students learn not only how to build models, but also how to frame questions, evaluate evidence, and communicate results responsibly.</p><p>This demo course mirrors that structure with concise lessons, practical activities, and assessment blocks that reflect a clean academic course layout.</p>",
            },
          },
          {
            type: "statement",
            content: {
              text: "Strong data science starts with a well-defined problem, not with a model.",
            },
          },
        ],
      },
      {
        title: "The Data Science Lifecycle",
        description: "An overview of the roles, phases, and milestones that shape real-world analytical projects.",
        blocks: [
          {
            type: "quote",
            content: {
              text: "The goal is to turn data into information, and information into insight.",
              author: "Carly Fiorina",
              citation: "Leadership perspective on analytics",
            },
          },
          {
            type: "list",
            content: {
              title: "Core stages of a typical project",
              type: "ordered",
              items: [
                { text: "Frame the problem and define success metrics." },
                { text: "Acquire, inspect, and prepare the data." },
                { text: "Explore patterns and test assumptions." },
                { text: "Model, evaluate, and communicate recommendations." },
              ],
            },
          },
          {
            type: "timeline",
            content: {
              title: "Lifecycle milestones",
              events: [
                { date: "Week 1", title: "Business framing", description: "Clarify the question, stakeholders, scope, and decision criteria." },
                { date: "Week 2", title: "Data acquisition", description: "Collect source data and assess completeness, reliability, and access constraints." },
                { date: "Week 3", title: "Analysis and modeling", description: "Use exploratory analysis and baseline models to identify signals worth testing." },
                { date: "Week 4", title: "Communication", description: "Translate findings into recommendations with caveats and next steps." },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Module 2: Working with Data",
    description: "Prepare learners to clean, organize, and inspect data before any modeling work begins.",
    chapters: [
      {
        title: "Preparing Data for Analysis",
        description: "Practical structures for cleaning, validating, and transforming messy datasets.",
        blocks: [
          {
            type: "accordion",
            content: {
              title: "Common preparation checks",
              items: [
                { title: "Completeness", content: "Review missing values, blank fields, and records that may need imputation or exclusion." },
                { title: "Consistency", content: "Standardize units, date formats, category labels, and naming conventions." },
                { title: "Validity", content: "Check for impossible values, duplicates, and outliers that suggest input errors." },
              ],
            },
          },
          {
            type: "process-flow",
            content: {
              title: "A clean preparation workflow",
              steps: [
                { title: "Audit", description: "Inspect structure, field meanings, and quality issues before changing anything." },
                { title: "Clean", description: "Resolve nulls, duplicates, and formatting inconsistencies with documented rules." },
                { title: "Transform", description: "Engineer features and reshape the dataset for analysis or modeling." },
                { title: "Validate", description: "Confirm that the prepared dataset still answers the original question." },
              ],
            },
          },
          {
            type: "sorting-activity",
            content: {
              title: "Sort each task into the right category",
              categories: ["Cleaning", "Transformation", "Validation"],
              items: [
                { text: "Remove duplicate customer records", category: "Cleaning" },
                { text: "Convert timestamps into month and quarter fields", category: "Transformation" },
                { text: "Compare summary statistics before and after preprocessing", category: "Validation" },
                { text: "Standardize inconsistent state abbreviations", category: "Cleaning" },
              ],
            },
          },
        ],
      },
      {
        title: "Exploratory Analysis and Visualization",
        description: "Use visuals and summaries to identify trends, anomalies, and relationships worth pursuing.",
        blocks: [
          {
            type: "image",
            content: {
              url: "/assets/stock-images/technology/data-visualization.svg",
              alt: "Illustration of charts and dashboards used in data analysis",
              caption: "Exploratory visualizations help analysts spot patterns before modeling.",
            },
          },
          {
            type: "gallery",
            content: {
              images: [
                { url: "/assets/stock-images/business/finance-charts.svg", alt: "Finance charts", caption: "Trend views highlight direction over time." },
                { url: "/assets/stock-images/technology/coding-laptop.svg", alt: "Analyst working with code", caption: "Notebook-based analysis supports rapid iteration." },
                { url: "/assets/stock-images/science/laboratory-research.svg", alt: "Research workflow", caption: "Exploration is a disciplined investigation, not random charting." },
              ],
              layout: "grid",
            },
          },
          {
            type: "labeled-graphic",
            content: {
              image: {
                url: "/assets/stock-images/technology/data-visualization.svg",
                alt: "Dashboard graphic with multiple chart regions",
              },
              labels: [
                { title: "Distribution", content: "Use histograms and box plots to study spread, skew, and unusual values." },
                { title: "Relationship", content: "Scatter plots help reveal correlation, clusters, and non-linear patterns." },
                { title: "Comparison", content: "Bar and grouped charts make differences across categories easier to interpret." },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Module 3: Statistical and Predictive Thinking",
    description: "Introduce the inferential and predictive tools that support evidence-based decisions.",
    chapters: [
      {
        title: "Statistics for Decision-Making",
        description: "Use descriptive and inferential methods to interpret evidence with care.",
        blocks: [
          {
            type: "flashcards",
            content: {
              title: "Key statistical terms",
              cards: [
                { front: "Mean", back: "The arithmetic average of a set of values." },
                { front: "Variance", back: "A measure of how spread out values are around the mean." },
                { front: "Confidence Interval", back: "A range of plausible values for an estimate, given sampling uncertainty." },
                { front: "P-value", back: "A measure used to assess how surprising data would be under a null hypothesis." },
              ],
            },
          },
          {
            type: "scenario",
            content: {
              title: "Choosing a recommendation",
              description: "A school wants to improve student retention. An analyst finds that attendance and early assignment completion strongly predict withdrawals. Which recommendation is most defensible?",
              choices: [
                { text: "Launch an intervention focused on early attendance and assignment follow-up." },
                { text: "Assume prediction means causation and redesign the entire curriculum immediately." },
                { text: "Ignore the model because some variables are imperfect." },
              ],
            },
          },
          {
            type: "quiz",
            content: {
              title: "Statistics Checkpoint",
              description: "Answer each question before moving on.",
              questions: [
                {
                  id: "stats-1",
                  type: "multiple-choice",
                  question: "Which measure best summarizes the center of a highly skewed distribution?",
                  options: ["Median", "Mode", "Variance", "Range"],
                  correctAnswer: "A",
                  explanation: "The median is more robust than the mean when extreme values pull the distribution.",
                },
                {
                  id: "stats-2",
                  type: "multiple-choice",
                  question: "What does a confidence interval communicate?",
                  options: [
                    "The exact value of the population parameter",
                    "A plausible range for the estimate",
                    "The total number of observations",
                    "The number of model features",
                  ],
                  correctAnswer: "B",
                  explanation: "Confidence intervals show a reasonable range for the parameter given the sample and method.",
                },
              ],
            },
          },
        ],
      },
      {
        title: "Machine Learning Essentials",
        description: "A concise introduction to model types, workflows, and evaluation tradeoffs.",
        blocks: [
          {
            type: "ai-text",
            content: {
              text: "Machine learning extends data science by learning patterns from examples and using them to support prediction or classification.",
              html: "<p>Machine learning extends data science by learning patterns from examples and using them to support prediction or classification. In academic courses, students typically begin with a baseline model, compare alternatives, and discuss why performance alone is not enough.</p><p>Interpretability, fairness, data leakage, and alignment with the original problem are all part of responsible model development.</p>",
              isGenerated: true,
            },
          },
          {
            type: "ai-image",
            content: {
              url: "/assets/stock-images/technology/Machine Learning.jpg",
              alt: "Concept illustration representing machine learning systems",
              caption: "AI-generated style visual for the machine learning lesson.",
              imagePrompt: "A clean academic illustration showing supervised learning concepts, features, labels, and model evaluation.",
              suggestedStyle: "Editorial academic diagram",
              isGenerated: true,
            },
          },
          {
            type: "ai-quiz",
            content: {
              title: "Machine Learning Knowledge Check",
              description: "A short AI-generated quiz on modeling concepts.",
              isGenerated: true,
              questions: [
                {
                  id: "ml-1",
                  type: "multiple-choice",
                  question: "Why do instructors often start with a baseline model?",
                  options: [
                    "To avoid splitting the data",
                    "To establish a reference point for improvement",
                    "To eliminate the need for feature engineering",
                    "To guarantee the best possible score",
                  ],
                  correctAnswer: "B",
                  explanation: "Baseline models show whether more complex approaches create meaningful value.",
                },
                {
                  id: "ml-2",
                  type: "multiple-choice",
                  question: "Which issue can inflate model performance during evaluation?",
                  options: ["Data leakage", "Cross-validation", "Feature scaling", "Class labels"],
                  correctAnswer: "A",
                  explanation: "Data leakage introduces information that would not be available at prediction time.",
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Module 4: Communication and Application",
    description: "Help learners present insight effectively and complete a university-style applied project.",
    chapters: [
      {
        title: "Communicating Insights with Impact",
        description: "Package technical work into clear narratives, visuals, and recommendations.",
        blocks: [
          {
            type: "video",
            content: {
              title: "Presenting analytical findings",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
              duration: "0:30",
            },
          },
          {
            type: "audio",
            content: {
              title: "Narrated takeaway",
              description: "A short audio summary of what makes analytics communication persuasive.",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
              duration: "0:05",
            },
          },
          {
            type: "continue",
            content: {
              text: "Continue to the capstone project brief",
              url: "",
            },
          },
        ],
      },
      {
        title: "Capstone Project Studio",
        description: "A polished final lesson that demonstrates how theory becomes an applied deliverable.",
        blocks: [
          {
            type: "assignment",
            content: {
              title: "Mini Project: Student Success Analysis",
              description: "Analyze a fictional student dataset and recommend two interventions that could improve student success outcomes.",
              objectives: [
                "Frame a measurable analytical question.",
                "Prepare and inspect the dataset using a documented process.",
                "Present findings in a concise academic report.",
              ],
              tasks: [
                {
                  id: "capstone-task-1",
                  title: "Prepare the dataset",
                  description: "Review data quality and document any cleaning decisions you make.",
                  requirements: ["Identify at least three quality checks.", "Explain how missing values were handled."],
                  estimatedTime: "45 minutes",
                },
                {
                  id: "capstone-task-2",
                  title: "Explore the data",
                  description: "Create visuals and summaries that reveal useful patterns.",
                  requirements: ["Include two charts.", "Write one paragraph interpreting each chart."],
                  estimatedTime: "60 minutes",
                },
                {
                  id: "capstone-task-3",
                  title: "Recommend an action",
                  description: "Translate findings into a brief recommendation for an academic leadership team.",
                  requirements: ["Support the recommendation with evidence.", "Acknowledge one limitation."],
                  estimatedTime: "30 minutes",
                },
              ],
              submissionGuidelines: {
                format: "4-6 slide briefing deck or 2-page report",
                deadline: "End of Week 4",
                instructions: "Use clear headings, cite assumptions, and keep visuals readable for non-technical stakeholders.",
              },
              rubric: [
                {
                  criterion: "Problem framing",
                  weight: 25,
                  exemplary: "Question is focused, measurable, and well justified.",
                  proficient: "Question is clear with minor gaps in scope.",
                  developing: "Question is partly defined but lacks precision.",
                  beginning: "Question is vague or disconnected from the analysis.",
                },
                {
                  criterion: "Analysis quality",
                  weight: 45,
                  exemplary: "Methods are appropriate, transparent, and well interpreted.",
                  proficient: "Methods are mostly appropriate with reasonable interpretation.",
                  developing: "Analysis shows partial understanding or weak interpretation.",
                  beginning: "Analysis is incomplete or unsupported.",
                },
                {
                  criterion: "Communication",
                  weight: 30,
                  exemplary: "Findings are clear, concise, and audience-aware.",
                  proficient: "Findings are understandable with small clarity issues.",
                  developing: "Communication is uneven or difficult to follow.",
                  beginning: "Findings are poorly organized or unclear.",
                },
              ],
              resources: [
                "Course notes on data preparation and visualization",
                "Statistical glossary flashcards",
                "Module 4 communication checklist",
              ],
              tips: [
                "Start with the question you want to answer before opening the dataset.",
                "Use visuals to support the story, not to replace explanation.",
              ],
            },
          },
          {
            type: "ai-assignment",
            content: {
              title: "AI Extension: Predictive Modeling Reflection",
              description: "Create a short reflective brief on how you would extend the project with a predictive model.",
              objectives: [
                "Connect machine learning concepts to the capstone context.",
                "Evaluate tradeoffs between performance and interpretability.",
              ],
              tasks: [
                {
                  id: "ai-capstone-task-1",
                  title: "Select a target variable",
                  description: "Explain which outcome you would predict and why it matters.",
                  requirements: ["State the target variable.", "Name two candidate features."],
                  estimatedTime: "20 minutes",
                },
                {
                  id: "ai-capstone-task-2",
                  title: "Propose an evaluation plan",
                  description: "Describe how you would test model quality and guard against misleading results.",
                  requirements: ["Choose at least one metric.", "Mention one bias or leakage risk."],
                  estimatedTime: "20 minutes",
                },
              ],
              submissionGuidelines: {
                format: "1-page reflection memo",
                deadline: "End of Week 4",
                instructions: "Keep the memo concise and tie each point back to course concepts.",
              },
              rubric: [
                {
                  criterion: "Conceptual alignment",
                  weight: 50,
                  exemplary: "Reflection links modeling choices directly to the project context.",
                  proficient: "Reflection is relevant with minor gaps.",
                  developing: "Reflection includes basic ideas but lacks depth.",
                  beginning: "Reflection is generic or off-topic.",
                },
                {
                  criterion: "Critical reasoning",
                  weight: 50,
                  exemplary: "Tradeoffs and risks are identified clearly and thoughtfully.",
                  proficient: "Tradeoffs are noted with adequate support.",
                  developing: "Some reasoning is present but underdeveloped.",
                  beginning: "Tradeoffs and risks are missing or superficial.",
                },
              ],
              resources: ["Machine Learning Essentials lesson", "Statistics Checkpoint answers"],
              tips: ["A simpler, well-explained model is often more valuable than a complex opaque one."],
              isGenerated: true,
            },
          },
          {
            type: "ai-audio",
            content: {
              title: "Capstone briefing narration",
              description: "AI-generated closing narration for the final project lesson.",
              script: "In this final activity, you will bring together problem framing, data preparation, exploratory analysis, and communication. Focus on producing a recommendation that is both evidence-based and understandable to decision-makers.",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
              duration: "0:05",
              isGenerated: true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Module 5: Responsible Data Science and Governance",
    description: "Introduce the ethical, institutional, and decision-making standards expected in university and professional analytics practice.",
    chapters: [
      {
        title: "Bias, Fairness, and Model Review",
        description: "Learn how a responsible analytics team evaluates model outputs before they shape real decisions.",
        blocks: [
          {
            type: "heading",
            content: { text: "Responsible Model Review" },
          },
          {
            type: "text",
            content: {
              text: "University programs in data science emphasize that model quality is never judged by accuracy alone.",
              html: "<p>University programs in data science emphasize that model quality is never judged by accuracy alone. Analysts must also examine fairness, transparency, and the institutional consequences of automated decisions.</p><p>Before a model is used in advising, admissions, finance, or public services, review teams check whether performance is consistent across groups and whether the model supports a decision that can be explained and defended.</p>",
            },
          },
          {
            type: "labeled-graphic",
            content: {
              image: {
                url: "/assets/stock-images/technology/data-visualization.svg",
                alt: "Model review board with evaluation areas highlighted",
              },
              labels: [
                { title: "Performance", content: "Review baseline metrics such as precision, recall, calibration, and stability before relying on the model.", x: 24, y: 32 },
                { title: "Fairness Check", content: "Compare outcomes across demographic or operational groups to see whether the model distributes errors unevenly.", x: 56, y: 45 },
                { title: "Governance Note", content: "Document assumptions, limitations, and escalation rules so the model can be reviewed by instructors, auditors, or stakeholders.", x: 78, y: 65 },
              ],
            },
          },
          {
            type: "accordion",
            content: {
              title: "Core governance questions",
              items: [
                { title: "What decision is being supported?", content: "Clarify whether the model informs screening, prioritization, prediction, or resource allocation." },
                { title: "Who may be affected?", content: "Identify the learners, customers, or communities most exposed to incorrect or unfair decisions." },
                { title: "How will results be challenged?", content: "Create a review path so decisions can be explained, questioned, and corrected when needed." },
              ],
            },
          },
        ],
      },
      {
        title: "Decision-Making in Real Analytics Contexts",
        description: "Practice choosing actions that are technically sound, ethically defensible, and aligned with institutional goals.",
        blocks: [
          {
            type: "scenario",
            content: {
              title: "Retention intervention case",
              description: "A university dashboard flags first-year students as high risk for withdrawal. The model is accurate overall, but its false-positive rate is significantly higher for part-time learners. What is the most defensible next step?",
              choices: [
                {
                  text: "Pause deployment and review subgroup performance before using the score operationally.",
                  feedback: "This is the strongest response because it balances action with governance. A university-style review would require checking whether the model disadvantages a specific student group before adoption.",
                  outcome: "Recommended",
                },
                {
                  text: "Deploy the model immediately because overall accuracy is above the target threshold.",
                  feedback: "Overall accuracy is not enough. A technically strong model can still produce inequitable or poorly governed outcomes if subgroup errors are ignored.",
                  outcome: "Not recommended",
                },
                {
                  text: "Discard analytics entirely and return to manual judgment.",
                  feedback: "This overcorrects. The better academic response is structured review, documentation, and adjustment rather than abandoning evidence-based tools.",
                  outcome: "Partial response",
                },
              ],
            },
          },
          {
            type: "list",
            content: {
              title: "A university review checklist",
              type: "unordered",
              items: [
                { text: "Confirm the model supports a clearly defined academic or operational decision." },
                { text: "Check whether results remain stable across relevant learner groups." },
                { text: "Document assumptions, caveats, and escalation criteria." },
                { text: "Present findings in language that a non-technical committee can evaluate." },
              ],
            },
          },
          {
            type: "process-flow",
            content: {
              title: "Responsible analytics approval flow",
              steps: [
                { title: "Frame", description: "Define the decision, stakeholders, and consequences of getting the analysis wrong." },
                { title: "Test", description: "Evaluate performance, fairness, and data quality before any operational use." },
                { title: "Review", description: "Present evidence to faculty, managers, or reviewers for challenge and approval." },
                { title: "Monitor", description: "Track the analysis after launch and document when retraining or withdrawal is required." },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Module 6: Research Communication and Portfolio Practice",
    description: "Extend the course with polished academic deliverables that resemble university workshop and seminar work.",
    chapters: [
      {
        title: "Building a Data Science Project Portfolio",
        description: "Organize applied work into a portfolio that demonstrates process, clarity, and methodological maturity.",
        blocks: [
          {
            type: "gallery",
            content: {
              layout: "grid",
              images: [
                { url: "/assets/stock-images/technology/coding-laptop.svg", alt: "Notebook workflow for analytics project", caption: "A portfolio should show the analytical workflow, not only the final chart." },
                { url: "/assets/stock-images/business/finance-charts.svg", alt: "Summary charts and dashboards", caption: "Include visuals that support a clear claim and a defensible interpretation." },
                { url: "/assets/stock-images/science/laboratory-research.svg", alt: "Research and documentation workflow", caption: "Strong submissions document assumptions, methods, and limitations." },
              ],
            },
          },
          {
            type: "accordion",
            content: {
              title: "Portfolio sections",
              items: [
                { title: "Problem framing", content: "Start with the institutional or business question, its context, and the intended audience." },
                { title: "Methodology", content: "Explain the dataset, analytical decisions, and why the chosen method fits the problem." },
                { title: "Reflection", content: "Discuss limitations, alternative approaches, and what you would improve in a second iteration." },
              ],
            },
          },
          {
            type: "continue",
            content: {
              text: "Continue to the research presentation workshop",
              url: "",
            },
          },
        ],
      },
      {
        title: "Presenting a Research-Style Case Study",
        description: "Use structured narrative, comparison, and audience-aware explanation to deliver a polished academic case study.",
        blocks: [
          {
            type: "heading",
            content: { text: "From Analysis to Academic Presentation" },
          },
          {
            type: "text",
            content: {
              text: "A well-designed university case study explains not just what the analyst found, but how the conclusion was reached and what limitations remain.",
              html: "<p>A well-designed university case study explains not just what the analyst found, but how the conclusion was reached and what limitations remain. The best course projects combine careful evidence with a presentation style that faculty, peer reviewers, or decision-makers can follow easily.</p><p>In practice, this means showing a logical sequence: problem, evidence, interpretation, recommendation, and reflection.</p>",
            },
          },
          {
            type: "scenario",
            content: {
              title: "Seminar presentation choice",
              description: "You have five minutes to present a student success case study to a faculty panel. Which opening is most effective?",
              choices: [
                {
                  text: "Begin with the decision question, then show one high-value visual and explain its implication.",
                  feedback: "This is the strongest academic structure. It respects the audience's time and frames the evidence around a clear question.",
                  outcome: "Recommended",
                },
                {
                  text: "Open with every preprocessing step in technical detail before explaining the purpose of the study.",
                  feedback: "Methodology matters, but leading with process before purpose weakens clarity and audience alignment.",
                  outcome: "Needs revision",
                },
                {
                  text: "Show the recommendation first and skip the evidence to save time.",
                  feedback: "A university-style presentation still needs traceable evidence. Recommendations without support are not persuasive.",
                  outcome: "Not recommended",
                },
              ],
            },
          },
          {
            type: "list",
            content: {
              title: "Presentation essentials",
              type: "ordered",
              items: [
                { text: "State the question in one sentence." },
                { text: "Show the evidence that most directly answers it." },
                { text: "Explain the implication for the audience." },
                { text: "Close with one recommendation and one limitation." },
              ],
            },
          },
        ],
      },
    ],
  },
];

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function ensureCourse() {
  if (COURSE_ID) {
    const existingCourse = await api(`/api/courses/${COURSE_ID}`);
    console.log(`Using existing course: ${existingCourse.title}`);
    return existingCourse;
  }

  const coursePayload = {
    title: "Data Science",
    topic: "Data Science",
    targetAudience:
      "University students, early-career analysts, and professionals who want a clean introduction to the data science workflow.",
    learningObjectives: `By the end of this course, learners will be able to:
- Explain the full data science workflow from business question to communication
- Prepare and inspect data using structured quality checks
- Interpret exploratory analysis, statistics, and basic machine learning outputs
- Present data-driven recommendations in a clear academic format`,
    duration: "6-10 hours",
    difficulty: "Beginner",
    status: "draft",
    referenceUrls: [],
  };

  const created = await api("/api/courses", {
    method: "POST",
    body: JSON.stringify(coursePayload),
  });
  console.log(`Created course: ${created.title}`);
  console.log(`Course ID: ${created.id}`);
  return created;
}

async function clearExistingModules(courseId) {
  const modules = await api(`/api/courses/${courseId}/modules`);
  const ordered = [...modules].sort((a, b) => parseInt(b.order, 10) - parseInt(a.order, 10));

  for (const module of ordered) {
    await api(`/api/modules/${module.id}`, { method: "DELETE" });
  }
}

async function createModule(courseId, payload) {
  return api(`/api/courses/${courseId}/modules`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createBlock(moduleId, block, index) {
  return api(`/api/modules/${moduleId}/content-blocks`, {
    method: "POST",
    body: JSON.stringify({
      type: block.type,
      content: block.content,
      order: String(index),
      blockStyle: "default",
      styling: {},
      accessibility: {},
    }),
  });
}

async function updateBlock(blockId, updates) {
  return api(`/api/content-blocks/${blockId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

async function buildDemoCourse(course) {
  await clearExistingModules(course.id);

  let globalOrder = 0;
  const chapterIds = [];
  const continueBlocks = [];

  for (const moduleTemplate of DEMO_STRUCTURE) {
    const parentModule = await createModule(course.id, {
      title: moduleTemplate.title,
      description: moduleTemplate.description,
      order: String(globalOrder++),
      lessonType: "block",
    });

    for (const chapterTemplate of moduleTemplate.chapters) {
      const chapter = await createModule(course.id, {
        parentModuleId: parentModule.id,
        title: chapterTemplate.title,
        description: chapterTemplate.description,
        order: String(globalOrder++),
        lessonType: "block",
      });

      chapterIds.push(chapter.id);

      for (const [index, block] of chapterTemplate.blocks.entries()) {
        const createdBlock = await createBlock(chapter.id, block, index);
        if (block.type === "continue") {
          continueBlocks.push({
            blockId: createdBlock.id,
            chapterId: chapter.id,
          });
        }
      }
    }
  }

  for (const continueBlock of continueBlocks) {
    const currentChapterIndex = chapterIds.findIndex((chapterId) => chapterId === continueBlock.chapterId);
    const nextChapterId = currentChapterIndex >= 0 ? chapterIds[currentChapterIndex + 1] : undefined;

    if (!nextChapterId) {
      continue;
    }

    const existingBlock = await api(`/api/content-blocks/${continueBlock.blockId}`);
    await updateBlock(continueBlock.blockId, {
      content: {
        ...(existingBlock.content || {}),
        url: `/module/${nextChapterId}/content`,
      },
    });
  }

  await api(`/api/courses/${course.id}/generate-cover-image`, { method: "POST" });
  return chapterIds;
}

async function main() {
  try {
    console.log(`Using API base: ${API_BASE}`);
    const course = await ensureCourse();

    console.log("Building Data Science demo structure and blocks...");
    const chapterIds = await buildDemoCourse(course);

    const refreshedCourse = await api(`/api/courses/${course.id}`);
    console.log(`Finished seeding course: ${refreshedCourse.title}`);
    console.log(`Course ID: ${refreshedCourse.id}`);
    console.log(`Chapters created: ${chapterIds.length}`);
    console.log(`Open in app: ${API_BASE}/my-courses`);
    console.log(`Direct launch: ${API_BASE}/module/${chapterIds[0]}/content`);
  } catch (error) {
    console.error("Error creating Data Science demo course:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
