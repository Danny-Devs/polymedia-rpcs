import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import {
  Box,
  Container,
  Flex,
  HStack,
  Heading,
  Image,
  Link,
  Text
} from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';

import { PageHome } from './PageHome';
import { PageNotFound } from './PageNotFound';

/* AppRouter */

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<PageHome />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

/* App */

export type AppContext = Record<string, never>;

const App: React.FC = () => {
  /* State */
  const appContext: AppContext = {};

  /* HTML */
  return (
    <Flex direction="column" minH="100vh">
      <Header />
      <Box as="main" flex="1" py={8}>
        <Container maxW="container.xl" px={4}>
          <Outlet context={appContext} />
        </Container>
      </Box>
      <Footer />
    </Flex>
  );
};

const Header: React.FC = () => {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex={1000}
      bg="rgba(0, 0, 0, 0.85)"
      backdropFilter="blur(10px)"
      borderBottom="1px solid"
      borderColor="whiteAlpha.100"
      py={3}
    >
      <Container maxW="container.xl" px={4}>
        <Flex justify="space-between" align="center">
          <HStack spacing={6}>
            <Link href="https://polymedia.app" isExternal>
              <Image
                src="https://assets.polymedia.app/img/all/logo-nomargin-transparent-512x512.webp"
                alt="Polymedia"
                boxSize="40px"
              />
            </Link>
            <Heading
              as="h1"
              size="md"
              bgGradient="linear(to-r, brand.300, brand.600)"
              bgClip="text"
              fontWeight="bold"
            >
              SUI RPC SPEED TEST
            </Heading>
          </HStack>

          <Text color="gray.400" fontSize="sm">
            Find the fastest Sui RPC node in your region
          </Text>
        </Flex>
      </Container>
    </Box>
  );
};

const Footer: React.FC = () => (
  <Box
    as="footer"
    py={6}
    bg="gray.900"
    borderTop="1px solid"
    borderColor="whiteAlpha.100"
  >
    <Container maxW="container.xl">
      <Flex justify="center" align="center" gap={4}>
        <Link href="https://polymedia.app" isExternal>
          <Image
            src="https://assets.polymedia.app/img/all/logo-nomargin-transparent-512x512.webp"
            alt="Polymedia"
            boxSize="30px"
          />
        </Link>
        <Link href="https://github.com/juzybits/polymedia-rpcs" isExternal>
          <FaGithub size={30} />
        </Link>
      </Flex>
    </Container>
  </Box>
);
