import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  Wallet,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  Cpu,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Fingerprint,
  Landmark,
  Gift
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees', to: '/employees', icon: Users },
  { name: 'Attendance', to: '/attendance', icon: Clock },
  { name: 'Payroll', to: '/payroll', icon: Wallet },
  { name: 'Recruitment', to: '/recruitment', icon: Briefcase },
  { name: 'Shifts', to: '/shifts', icon: CalendarClock },
  { name: 'Leave', to: '/leave', icon: CalendarDays },
  { name: 'Loans', to: '/loans', icon: Landmark },
  { name: 'Festival Bonus', to: '/festival-bonus', icon: Gift },
  { name: 'Holidays', to: '/holidays', icon: CalendarCheck },
  { name: 'Devices', to: '/devices', icon: Cpu },
  { name: 'Profile', to: '/profile', icon: UserCircle },
  { name: 'Settings', to: '/settings', icon: Settings }
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = (
    <>
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">ZKT Payroll</p>
          <p className="text-xs text-muted-foreground mt-1">HR System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            {user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {user ? `${user.firstName} ${user.lastName}` : 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user ? user.email : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-card border-r border-border">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-md p-2 hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold lg:text-base">ZKT Payroll HR System</h1>
          </div>
          <NavLink
            to="/profile"
            className="rounded-md p-2 hover:bg-accent"
          >
            <UserCircle className="h-5 w-5" />
          </NavLink>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;