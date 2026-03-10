# Global Toast Integration Guide

## Overview
The toast notification system is now globally available through the `useToast()` hook. Replace all local notification states with this hook.

## Implementation Steps

### 1. Import the hook
```typescript
import { useToast } from '../context/ToastContext';
```

### 2. Use in component
```typescript
const MyComponent: React.FC = () => {
  const { showToast } = useToast();

  const handleAction = async () => {
    try {
      await apiService.doSomething();
      showToast('success', 'Action completed successfully!');
    } catch (err) {
      showToast('error', 'Action failed. Please try again.');
    }
  };

  return <button onClick={handleAction}>Do Action</button>;
};
```

### 3. Remove old notification code
Delete these from your component:
- `const [notification, setNotification] = useState(...)`
- `useEffect(() => { if (notification) { ... } }, [notification])`
- The notification UI rendering code

## Pages to Update (Priority Order)

1. **EventsManagement.tsx** - Event CRUD operations
2. **UserSettings.tsx** - Profile/settings updates
3. **RegistrationForm.tsx** - Form submissions
4. **CheckIn.tsx** - Check-in actions
5. **RegistrationsList.tsx** - Bulk operations
6. **OrganizerSettings.tsx** - Organizer profile updates
7. **EmailSettings.tsx** - Email config changes
8. **PaymentSettings.tsx** - Payment gateway updates
9. **TeamSettings.tsx** - Team member operations
10. **AccountSettings.tsx** - Account changes

## Toast API

```typescript
showToast(type: 'success' | 'error', message: string, duration?: number)
```

- `type`: 'success' (green) or 'error' (red)
- `message`: Toast message text
- `duration`: Auto-dismiss time in ms (default: 3500ms)

## Example Replacements

### Before (Local State)
```typescript
const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

useEffect(() => {
  if (notification) {
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }
}, [notification]);

// In JSX
{notification && (
  <div className="fixed top-24 right-8 z-[120]">
    <Card className={...}>
      {notification.message}
    </Card>
  </div>
)}
```

### After (Global Toast)
```typescript
const { showToast } = useToast();

// In handlers
showToast('success', 'Changes saved successfully!');
showToast('error', 'Failed to save changes.');
```

## Benefits
- ✅ Consistent UI across entire app
- ✅ Automatic positioning and styling
- ✅ No duplicate notification code
- ✅ Centralized state management
- ✅ Better memory management
