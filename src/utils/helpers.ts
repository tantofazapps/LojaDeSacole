export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Compress to JPEG with 0.7 quality to keep base64 string small for Firestore
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = error => reject(error);
  });
};

export const THEMES = {
  orange: {
    primary: 'bg-orange-500',
    hover: 'hover:bg-orange-600',
    text: 'text-orange-500',
    light: 'bg-orange-50',
    border: 'border-orange-200',
    gradient: 'from-orange-500 to-amber-500'
  },
  pink: {
    primary: 'bg-pink-500',
    hover: 'hover:bg-pink-600',
    text: 'text-pink-500',
    light: 'bg-pink-50',
    border: 'border-pink-200',
    gradient: 'from-pink-500 to-rose-500'
  },
  purple: {
    primary: 'bg-purple-500',
    hover: 'hover:bg-purple-600',
    text: 'text-purple-500',
    light: 'bg-purple-50',
    border: 'border-purple-200',
    gradient: 'from-purple-500 to-fuchsia-500'
  },
  green: {
    primary: 'bg-emerald-500',
    hover: 'hover:bg-emerald-600',
    text: 'text-emerald-500',
    light: 'bg-emerald-50',
    border: 'border-emerald-200',
    gradient: 'from-emerald-500 to-teal-500'
  },
  blue: {
    primary: 'bg-blue-500',
    hover: 'hover:bg-blue-600',
    text: 'text-blue-500',
    light: 'bg-blue-50',
    border: 'border-blue-200',
    gradient: 'from-blue-500 to-cyan-500'
  }
};
