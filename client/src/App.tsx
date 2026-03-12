import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import MyCourses from "@/pages/my-courses";
import Templates from "@/pages/templates";
import CourseSetup from "@/pages/course-setup";
import ModuleContent from "@/pages/chapter-content";
import QuizEditor from "@/pages/quiz-editor";
import Resources from "@/pages/resources";
import Header from "@/components/layout/header";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/my-courses" component={MyCourses} />
      <Route path="/templates" component={Templates} />
      <Route path="/course-setup" component={CourseSetup} />
      
      <Route path="/module/:moduleId/content" component={ModuleContent} />
      <Route path="/module/:moduleId/content/:contentBlockId" component={ModuleContent} />
      <Route path="/quiz/:contentBlockId/edit" component={QuizEditor} />
      <Route path="/resources" component={Resources} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isQuizEditor = location.startsWith('/quiz/') && location.includes('/edit');
  const isModuleContent = location.startsWith('/module/');
  const shouldShowHeader = !isQuizEditor && !isModuleContent;
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="h-screen bg-background flex flex-col overflow-hidden">
          {shouldShowHeader && <Header />}
          <div className={`flex-1 ${isModuleContent ? 'overflow-hidden' : 'overflow-auto'}`}>
            <Router />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
