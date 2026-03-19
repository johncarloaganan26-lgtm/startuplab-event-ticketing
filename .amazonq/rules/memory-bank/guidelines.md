# Development Guidelines

## Code Quality Standards

### Formatting and Structure
- **Indentation**: 2 spaces for JavaScript/TypeScript, consistent throughout
- **Line Length**: No strict limit, but prefer readability over long lines
- **Semicolons**: Used consistently in backend JavaScript, optional in frontend TypeScript/React
- **Quotes**: Single quotes for JavaScript strings, double quotes in JSX attributes
- **Trailing Commas**: Used in multi-line arrays and objects

### Naming Conventions
- **Variables/Functions**: camelCase (e.g., `handleLogout`, `userMenuOpen`, `fetchNotifications`)
- **React Components**: PascalCase (e.g., `PortalLayout`, `PublicLayout`, `ToastContainer`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API`, `DEFAULT_HEADER_LOCATION`, `BROWSE_LOCATION_STORAGE_KEY`)
- **Database Fields**: snake_case (e.g., `event_id`, `created_at`, `is_archived`)
- **CSS Classes**: kebab-case with Tailwind utility classes
- **File Names**: PascalCase for components, camelCase for utilities

### Documentation Standards
- **Inline Comments**: Used sparingly, only for complex logic or non-obvious behavior
- **JSDoc Comments**: Minimal usage, code should be self-documenting
- **Section Comments**: Used to separate major sections (e.g., `// Sidebar for desktop`, `// Mobile Menu Dropdown`)
- **TODO Comments**: Not prevalent in codebase

## Architectural Patterns

### Backend Patterns

#### Controller-Route-Service Architecture
```javascript
// Controllers handle business logic
export const listEvents = async (req, res) => {
  try {
    const { data, error } = await supabase.from('events').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ events: data });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
};
```

#### Error Handling Pattern
- Always wrap async operations in try-catch
- Return consistent error response format: `{ error: message }`
- Log errors to console with descriptive prefixes (e.g., `❌ [Event Slug] Error:`)
- Use HTTP status codes appropriately (400, 404, 500)

#### Database Query Pattern
```javascript
// Supabase query pattern
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('field', value)
  .order('created_at', { ascending: false });

if (error) return res.status(500).json({ error: error.message });
```

#### Enrichment Pattern
```javascript
// Enrich data with related information
const enrichedEvents = await enrichEventsWithOrganizer(events);
const likeCounts = await getEventLikeCountsMap(eventIds);
```

### Frontend Patterns

#### React Component Structure
```typescript
// Functional components with hooks
const ComponentName: React.FC<{ prop: Type }> = ({ prop }) => {
  const [state, setState] = React.useState(initialValue);
  
  React.useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  const handleAction = () => {
    // Event handlers
  };
  
  return (
    <div className="tailwind-classes">
      {/* JSX */}
    </div>
  );
};
```

#### State Management Pattern
- **Local State**: `useState` for component-specific state
- **Context API**: Used for global state (UserContext, ToastContext, EngagementContext)
- **Derived State**: Compute from existing state rather than storing separately

#### Context Provider Pattern
```typescript
// Context definition and provider
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState>(initialState);
  
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook for consuming context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
```

#### API Service Pattern
```typescript
// Centralized API calls
export const apiService = {
  async getEvents(params: EventParams) {
    const response = await fetch(`${API}/api/events?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  }
};
```

## Common Implementation Patterns

### Authentication Flow
1. Check session with `/api/whoAmI` endpoint
2. Store user data in UserContext
3. Protect routes with `RequireRoleRoute` component
4. Clear session on logout (backend + Supabase + localStorage)

### Form Handling
```typescript
const [formData, setFormData] = useState({ field: '' });
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  
  try {
    const response = await apiService.submitForm(formData);
    // Handle success
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Modal Pattern
```typescript
const [modalOpen, setModalOpen] = useState(false);

// Modal with backdrop
{modalOpen && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setModalOpen(false)} />
    <div className="fixed ... z-50">
      {/* Modal content */}
    </div>
  </>
)}
```

### Dropdown Menu Pattern
```typescript
const [menuOpen, setMenuOpen] = useState(false);

// Close on outside click
useEffect(() => {
  const handleOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  };
  document.addEventListener('mousedown', handleOutside);
  return () => document.removeEventListener('mousedown', handleOutside);
}, []);
```

### Pagination Pattern
```javascript
const page = parseInt(req.query.page, 10) || 1;
const limit = parseInt(req.query.limit, 10) || 10;
const offset = (page - 1) * limit;

// Apply pagination
const paginatedData = data.slice(offset, offset + limit);

return res.json({
  data: paginatedData,
  pagination: {
    page,
    limit,
    total: data.length,
    totalPages: Math.ceil(data.length / limit)
  }
});
```

## Styling Guidelines

### Tailwind CSS Usage
- **Utility-First**: Use Tailwind utility classes directly in JSX
- **Responsive Design**: Mobile-first with `sm:`, `md:`, `lg:` breakpoints
- **Custom Colors**: Brand colors defined in constants (`#38BDF2`, `#2E2E2F`, `#F2F2F2`)
- **Spacing**: Consistent use of spacing scale (px-4, py-2, gap-3, etc.)
- **Transitions**: `transition-all duration-300` for smooth animations

### Component Styling Pattern
```typescript
// Conditional classes with template literals
className={`base-classes ${
  isActive 
    ? 'active-classes' 
    : 'inactive-classes hover:hover-classes'
}`}

// Dynamic classes based on props
className={`flex items-center ${
  desktopSidebarOpen ? 'w-64' : 'w-20'
} transition-all duration-300`}
```

### Animation Classes
- `animate-in` - Fade in animation
- `slide-in-from-right-8` - Slide from right
- `fade-in` - Opacity transition
- `zoom-in` - Scale transition
- `animate-spin` - Loading spinner
- `animate-pulse` - Pulsing effect

## TypeScript Patterns

### Type Definitions
```typescript
// Interface for component props
interface ComponentProps {
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}

// Type for API responses
type EventResponse = {
  events: Event[];
  pagination: PaginationData;
};

// Enum for constants
enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  STAFF = 'STAFF',
  ATTENDEE = 'ATTENDEE'
}
```

### Type Safety
- Use explicit types for function parameters and return values
- Avoid `any` type - use `unknown` or specific types
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Type guard functions for runtime type checking

## Security Practices

### Authentication
- JWT tokens stored in HTTP-only cookies
- Session validation on protected routes
- Role-based access control (RBAC)
- Supabase Auth integration for user management

### Data Validation
- Input sanitization on backend
- Query parameter validation with defaults
- File upload validation (type, size)
- SQL injection prevention via Supabase parameterized queries

### Environment Variables
- Sensitive data in `.env` files (never committed)
- Different configs for development/production
- API keys and secrets server-side only

## Performance Optimization

### Frontend
- React.memo for expensive components (not heavily used)
- useCallback for event handlers passed to children
- Lazy loading for routes (not implemented yet)
- Image optimization with proper sizing
- Debouncing for search inputs

### Backend
- Database query optimization (select only needed fields)
- Pagination for large datasets
- Caching strategies (not heavily implemented)
- Batch operations where possible

## Testing Approach
- Manual testing emphasized over automated tests
- Test scripts in backend for specific features
- Console logging for debugging (with emoji prefixes: 🔍, ✅, ❌, ⚠️)
- Error boundary components (not heavily used)

## Git Workflow
- Feature-based development
- Descriptive commit messages
- Migration files with timestamps (YYYYMMDD format)
- Database schema versioning

## Common Code Idioms

### Null Safety
```typescript
const value = data?.field ?? defaultValue;
const name = user?.name?.trim() || 'Guest';
```

### Array Operations
```javascript
// Map with enrichment
const enriched = items.map(item => ({ ...item, extra: computeExtra(item) }));

// Filter with multiple conditions
const filtered = events.filter(e => e.status === 'PUBLISHED' && !e.is_archived);

// Reduce for aggregation
const total = items.reduce((sum, item) => sum + item.value, 0);
```

### Async/Await Pattern
```javascript
// Always use try-catch with async
try {
  const result = await asyncOperation();
  // Handle success
} catch (err) {
  console.error('Error:', err);
  // Handle error
} finally {
  // Cleanup
}
```

### Conditional Rendering
```typescript
// Short-circuit evaluation
{isLoading && <Spinner />}

// Ternary for two states
{isAuthenticated ? <Dashboard /> : <Login />}

// Nullish coalescing for defaults
{data?.length ?? 0}
```

## API Design Patterns

### RESTful Endpoints
- `GET /api/events` - List events
- `GET /api/events/:id` - Get single event
- `POST /api/events` - Create event
- `PATCH /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Response Format
```javascript
// Success response
{ success: true, data: result }

// Error response
{ error: 'Error message' }

// Paginated response
{ 
  data: items, 
  pagination: { page, limit, total, totalPages } 
}
```

### Query Parameters
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search term
- `status` - Filter by status
- `sortBy` - Sort field

## Frequently Used Annotations

### React Hooks
- `useState` - Local component state
- `useEffect` - Side effects and lifecycle
- `useContext` - Access context values
- `useCallback` - Memoized callbacks
- `useRef` - DOM references and mutable values
- `useNavigate` - Programmatic navigation
- `useLocation` - Current route information
- `useSearchParams` - URL query parameters

### TypeScript Annotations
- `React.FC<Props>` - Functional component type
- `async (req, res) => {}` - Async route handler
- `?: Type` - Optional property
- `| null` - Nullable type
- `Array<Type>` or `Type[]` - Array types

## Development Workflow

### Adding New Features
1. Create database migration if needed
2. Add backend controller and route
3. Create/update frontend components
4. Add to navigation/routing
5. Test manually with various scenarios
6. Update documentation if significant

### Debugging Approach
- Console.log with descriptive prefixes
- Browser DevTools for frontend
- Network tab for API calls
- Supabase dashboard for database queries
- Error boundaries for React errors (minimal usage)

## Code Review Checklist
- [ ] Consistent naming conventions
- [ ] Proper error handling
- [ ] Type safety (TypeScript)
- [ ] Responsive design (mobile-first)
- [ ] Security considerations
- [ ] Performance implications
- [ ] Code readability
- [ ] No hardcoded credentials
- [ ] Proper state management
- [ ] Accessibility considerations
