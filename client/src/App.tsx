import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
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

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const isQuizEditor = location.startsWith('/quiz/') && location.includes('/edit');
  const isModuleContent = location.startsWith('/module/');
  const shouldShowHeader = isAuthenticated && !isQuizEditor && !isModuleContent;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated && location !== "/login") {
      sessionStorage.setItem("opuslearn-post-login-path", location);
      setLocation("/login");
      return;
    }

    if (isAuthenticated && location === "/login") {
      const redirectPath = sessionStorage.getItem("opuslearn-post-login-path") || "/";
      sessionStorage.removeItem("opuslearn-post-login-path");
      setLocation(redirectPath === "/login" ? "/" : redirectPath);
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_100%)]">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-lg">
          <div className="text-lg font-semibold text-slate-900">Loading oPuslearn</div>
          <div className="mt-2 text-sm text-slate-500">Restoring your workspace session.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }
  
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {shouldShowHeader && <Header />}
      <div className={`flex-1 ${isModuleContent ? 'overflow-hidden' : 'overflow-auto'}`}>
        <Router />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppShell />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
