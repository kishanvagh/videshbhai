import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, CreditCard, ArrowLeftRight, Users, BarChart3, Settings, Gem, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sold-items', icon: ShoppingBag, label: 'Sold Items' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/currency-exchange', icon: ArrowLeftRight, label: 'Currency Exchange' },
  { to: '/parties', icon: Users, label: 'Parties' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logoutUser } = useAuth();
  
  return (
    <aside className="w-64 min-h-screen bg-navy-700 text-white flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center">
            <Gem size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{user?.businessName || 'JewelBiz'}</p>
            <p className="text-white/50 text-xs">Accounting</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gold-500 text-white font-semibold shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center">
            <span className="text-gold-400 text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-white/40 text-xs truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button onClick={logoutUser} className="flex items-center gap-2 text-white/60 hover:text-red-400 text-xs transition-colors w-full">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
