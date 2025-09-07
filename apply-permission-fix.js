const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'app/recipes/page.tsx', pageName: 'recipes' },
  { file: 'app/branches/page.tsx', pageName: 'branches' },
  { file: 'app/produksi/page.tsx', pageName: 'produksi' },
  { file: 'app/product_name/page.tsx', pageName: 'product_name' },
  { file: 'app/categories/page.tsx', pageName: 'categories' }
];

pages.forEach(({ file, pageName }) => {
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add imports if not present
    if (!content.includes('hasPageAccess')) {
      content = content.replace(
        /import { canPerformActionSync[^}]*} from '@\/src\/utils\/rolePermissions';/,
        `import { canPerformActionSync, reloadPermissions } from '@/src/utils/rolePermissions';
import { hasPageAccess } from '@/src/utils/permissionChecker';`
      );
    }
    
    // Add hasAccess state
    if (!content.includes('hasAccess')) {
      content = content.replace(
        /const \[userRole, setUserRole\] = useState<string>\('guest'\);/,
        `const [userRole, setUserRole] = useState<string>('guest');
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);`
      );
    }
    
    // Add access check in useEffect
    const accessCheckCode = `
  // Check page access
  useEffect(() => {
    const checkUserAccess = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role || 'guest');
        
        await reloadPermissions();
        const pageAccess = await hasPageAccess(user.role, '${pageName}');
        setHasAccess(pageAccess);
      } else {
        setHasAccess(false);
      }
    }
    checkUserAccess();
  }, []);`;
    
    // Add access check before existing useEffect
    if (!content.includes('checkUserAccess')) {
      content = content.replace(
        /useEffect\(\(\) => \{/,
        `${accessCheckCode}

  useEffect(() => {`
      );
    }
    
    console.log(`Updated ${file} for ${pageName} page`);
    fs.writeFileSync(filePath, content);
  } else {
    console.log(`File not found: ${file}`);
  }
});

console.log('Permission fixes applied to all pages!');