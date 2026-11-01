export function formatCurrency(amount: number, currency: string = 'LKR'): string {
  const rounded = Math.round(amount * 100) / 100;
  
  switch (currency.toUpperCase()) {
    case 'LKR':
      return `Rs. ${rounded.toLocaleString('en-LK', {
        minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`;
    case 'USD':
      return `$${rounded.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case 'EUR':
      return `€${rounded.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case 'GBP':
      return `£${rounded.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    default:
      return `${currency} ${rounded.toLocaleString()}`;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-indigo-600 text-white',
    'bg-teal-600 text-white',
    'bg-blue-600 text-white',
    'bg-violet-600 text-white',
    'bg-rose-600 text-white',
    'bg-amber-600 text-white',
    'bg-emerald-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
