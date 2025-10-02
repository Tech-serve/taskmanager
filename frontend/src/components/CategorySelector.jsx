import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Категории для расходов
export const EXPENSE_CATEGORIES = {
  'sweep-stakes': {
    name: 'Sweep Stakes',
    subcategories: {
      'accounts': 'Аккаунты',
      'proxy-domains-zeus': 'Прокси/домены/Zeus',
      'services': 'Сервисы (chat gpt, Tyver и дт)',
      'fakes': 'Фейки',
      'other': 'Прочее'
    }
  },
  'igaming': {
    name: 'IGaming',
    subcategories: {
      'accounts-fb': 'Аккаунты FB',
      'accounts-uac': 'Аккаунты UAC',
      'creatives': 'Креативы',
      'google-play-console': 'Google Play Console',
      'services-neural': 'Сервисы (нейронка,Tyver, Notion и тд)',
      'proxy-domains-keitaro': 'Прокси/домены/Keitaro',
      'other': 'Прочее'
    }
  },
  'hr-department': {
    name: 'Отдел HR',
    subcategories: {
      'vacancies-ads': 'Вакансии/реклама',
      'candidate-purchase': 'Покупка кандидатов',
      'services': 'Сервисы',
      'polygraph': 'Полиграф',
      'books-materials': 'Книги.учебные материалы',
      'teambuilding': 'Тимбилдинг/корпоратив (развлекательные материалы)',
      'other': 'Прочее'
    }
  },
  'office': {
    name: 'Офис',
    subcategories: {
      'household-goods': 'Хоз. товары',
      'products-water': 'Продукты/вода',
      'services-gpt': 'Сервисы (chat gpt и тд)',
      'hookah': 'Кальян',
      'furniture-electronics': 'Мебель/электроника',
      'repair-security': 'Ремонт/Безопасность',
      'charity': 'Благотворительность',
      'other': 'Прочее'
    }
  }
};

export const getCategoryDisplayName = (categoryId) => {
  if (!categoryId) return '';
  
  const [mainCategory, subCategory] = categoryId.split('.');
  const category = EXPENSE_CATEGORIES[mainCategory];
  
  if (!category) return categoryId;
  
  if (subCategory && category.subcategories[subCategory]) {
    return `${category.name} → ${category.subcategories[subCategory]}`;
  }
  
  return category.name;
};

const CategorySelector = ({ open, onClose, onSelect, boardCategories = null }) => {
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');

  // Use board-specific categories if available, otherwise use default
  const categories = boardCategories || EXPENSE_CATEGORIES;

  const handleMainCategoryChange = (value) => {
    setSelectedMainCategory(value);
    setSelectedSubCategory(''); // Reset subcategory when main category changes
  };

  const handleSubCategoryChange = (value) => {
    setSelectedSubCategory(value);
  };

  const handleConfirm = () => {
    if (selectedMainCategory && selectedSubCategory) {
      const categoryId = `${selectedMainCategory}.${selectedSubCategory}`;
      const categoryName = getCategoryDisplayName(categoryId);
      onSelect(categoryId, categoryName);
      onClose();
      // Reset selections
      setSelectedMainCategory('');
      setSelectedSubCategory('');
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedMainCategory('');
    setSelectedSubCategory('');
  };

  const availableSubcategories = selectedMainCategory ? categories[selectedMainCategory]?.subcategories || {} : {};

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-600 border dark:border-gray-500">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Выберите категорию расхода
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Main Category Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
              Основная категория
            </label>
            <Select value={selectedMainCategory} onValueChange={handleMainCategoryChange}>
              <SelectTrigger className="w-full dark:bg-gray-500 dark:border-gray-400 dark:text-white">
                <SelectValue placeholder="Выберите основную категорию..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-600 dark:border-gray-500">
                {Object.entries(categories).map(([key, category]) => (
                  <SelectItem 
                    key={key} 
                    value={key}
                    className="dark:text-white dark:hover:bg-gray-500"
                  >
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategory Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
              Подкатегория
            </label>
            <Select 
              value={selectedSubCategory} 
              onValueChange={handleSubCategoryChange}
              disabled={!selectedMainCategory}
            >
              <SelectTrigger className="w-full dark:bg-gray-500 dark:border-gray-400 dark:text-white disabled:opacity-50">
                <SelectValue placeholder={selectedMainCategory ? "Выберите подкатегорию..." : "Сначала выберите основную категорию"} />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-600 dark:border-gray-500">
                {Object.entries(availableSubcategories).map(([key, name]) => (
                  <SelectItem 
                    key={key} 
                    value={key}
                    className="dark:text-white dark:hover:bg-gray-500"
                  >
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400"
          >
            Отмена
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedMainCategory || !selectedSubCategory}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Подтвердить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategorySelector;