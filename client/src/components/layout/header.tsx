import { useState } from "react";
import { Bell, KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ChangePasswordDialog from "@/components/auth/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";

export default function Header() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isHome = location === "/";
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const initials = user?.username.slice(0, 2).toUpperCase() ?? "OL";

  const handleLogout = async () => {
    await logout();
    window.location.assign("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-2" data-testid="link-home">
                <div className="text-2xl font-bold text-primary whitespace-nowrap">oPuslearn</div>
                {isHome && (
                  <div className="whitespace-nowrap text-sm text-muted-foreground">AI Course Authoring</div>
                )}
              </Link>
            </div>
            <nav className="hidden flex-shrink lg:flex lg:space-x-8">
              <Link href="/" className="text-foreground transition-colors hover:text-primary" data-testid="link-dashboard">
                Home
              </Link>
              <Link href="/my-courses" className="text-foreground transition-colors hover:text-primary" data-testid="link-courses">
                My Courses
              </Link>
              <Link href="/templates" className="text-foreground transition-colors hover:text-primary" data-testid="link-templates">
                Templates
              </Link>
              <Link href="/resources" className="text-foreground transition-colors hover:text-primary" data-testid="link-resources">
                Resources
              </Link>
            </nav>
            <div className="flex flex-shrink-0 items-center gap-3">
              <button className="text-muted-foreground hover:text-foreground" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-slate-300">
                    <Avatar className="h-9 w-9 border border-slate-200">
                      <AvatarFallback className="bg-sky-50 text-sm font-semibold text-sky-700">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <div className="text-sm font-semibold text-slate-900">{user?.username}</div>
                      <div className="text-xs text-slate-500">
                        {user?.isGuest ? "Guest access" : user?.mustChangePassword ? "Default password active" : "Signed in"}
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user?.canChangePassword && (
                    <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
                      <KeyRound className="h-4 w-4" />
                      Change password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
    </>
  );
}
