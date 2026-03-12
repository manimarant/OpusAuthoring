import { Bell } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Header() {
  const [location] = useLocation();
  const isHome = location === "/";

  return (
    <header className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 min-w-0" data-testid="link-home">
              <div className="text-2xl font-bold text-primary whitespace-nowrap">OpusLearn</div>
              {isHome && (
                <div className="text-sm text-muted-foreground whitespace-nowrap">AI Course Authoring</div>
              )}
            </Link>
          </div>
          <nav className="hidden lg:flex space-x-8 flex-shrink">
            <Link href="/" className="text-foreground hover:text-primary transition-colors" data-testid="link-dashboard">
              Dashboard
            </Link>
            <Link href="/my-courses" className="text-foreground hover:text-primary transition-colors" data-testid="link-courses">
              My Courses
            </Link>
            <Link href="/templates" className="text-foreground hover:text-primary transition-colors" data-testid="link-templates">
              Templates
            </Link>
            <Link href="/resources" className="text-foreground hover:text-primary transition-colors" data-testid="link-resources">
              Resources
            </Link>
          </nav>
          <div className="flex items-center gap-4 flex-shrink-0">
            <button className="text-muted-foreground hover:text-foreground" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
