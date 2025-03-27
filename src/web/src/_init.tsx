import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';

import { AppRouter } from './App';

// Custom theme with dark mode as default
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white'
      }
    }
  },
  colors: {
    brand: {
      50: '#e0f7ff',
      100: '#b8e4ff',
      200: '#8dd0fb',
      300: '#60bbf6',
      400: '#38a7f0',
      500: '#198edb', // primary brand color
      600: '#106fd4',
      700: '#0852ab',
      800: '#033681',
      900: '#001c58'
    }
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: '500'
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600'
          }
        }
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById('app') as Element).render(
  <ChakraProvider theme={theme}>
    <AppRouter />
  </ChakraProvider>
);
