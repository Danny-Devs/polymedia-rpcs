import { Box, Heading, Text, Center } from '@chakra-ui/react';

export const PageNotFound: React.FC = () => {
  return (
    <Center minH="50vh" flexDirection="column" gap={4}>
      <Heading
        as="h1"
        size="4xl"
        bgGradient="linear(to-r, pink.400, purple.600, blue.500)"
        bgClip="text"
        fontWeight="extrabold"
      >
        404
      </Heading>
      <Text fontSize="xl" color="gray.400">
        Page not found.
      </Text>
    </Center>
  );
};
