import { Stack, Text, LoadingOverlay, Center, Loader, ThemeIcon } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { debounce, isEqual } from 'lodash-es';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { ImagesCard } from '~/components/Image/Infinite/ImagesCard';
import { removeEmpty } from '~/utils/object-helpers';
import { BrowsingMode, ImageSort } from '~/server/common/enums';
import { useImageFilters, useQueryImages } from '~/components/Image/image.utils';
import { MasonryColumns } from '~/components/MasonryColumns/MasonryColumns';
import { useInView } from 'react-intersection-observer';
import { IconCloudOff } from '@tabler/icons-react';
import { ImageIngestionStatus, MediaType, MetricTimeframe, ReviewReactions } from '@prisma/client';
import { EndOfFeed } from '~/components/EndOfFeed/EndOfFeed';
import { IsClient } from '~/components/IsClient/IsClient';
import { MasonryRenderItemProps } from '~/components/MasonryColumns/masonry.types';
import { ImageGetInfinite } from '~/types/router';
import { ImageIngestionProvider } from '~/components/Image/Ingestion/ImageIngestionProvider';
import { ImagesProvider } from '~/components/Image/Providers/ImagesProvider';

type ImageFilters = {
  modelId?: number;
  modelVersionId?: number;
  postId?: number;
  collectionId?: number;
  username?: string;
  reviewId?: number;
  prioritizedUserIds?: number[];
  period?: MetricTimeframe;
  sort?: ImageSort;
  reactions?: ReviewReactions[];
  types?: MediaType[];
  withMeta?: boolean;
  followed?: boolean;
  browsingMode?: BrowsingMode;
};

type ImagesInfiniteProps = {
  withTags?: boolean;
  filters?: ImageFilters;
  showEof?: boolean;
  renderItem?: React.ComponentType<MasonryRenderItemProps<ImageGetInfinite[number]>>;
};

export default function ImagesInfinite({
  withTags,
  filters: filterOverrides = {},
  showEof = false,
  renderItem: MasonryItem,
}: ImagesInfiniteProps) {
  const { ref, inView } = useInView();
  const imageFilters = useImageFilters('images');
  const filters = removeEmpty({ ...imageFilters, ...filterOverrides, withTags });
  showEof = showEof && filters.period !== MetricTimeframe.AllTime;
  const [debouncedFilters, cancel] = useDebouncedValue(filters, 500);

  const { images, isLoading, fetchNextPage, hasNextPage, isRefetching, isFetching } =
    useQueryImages(debouncedFilters, { keepPreviousData: true });
  const debouncedFetchNextPage = useMemo(() => debounce(fetchNextPage, 500), [fetchNextPage]);

  // #region [infinite data fetching]
  useEffect(() => {
    if (inView && !isFetching) {
      debouncedFetchNextPage();
    }
  }, [debouncedFetchNextPage, inView, isFetching]);
  // #endregion

  //#region [useEffect] cancel debounced filters
  useEffect(() => {
    if (isEqual(filters, debouncedFilters)) cancel();
  }, [cancel, debouncedFilters, filters]);
  //#endregion

  return (
    <IsClient>
      {isLoading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : !!images.length ? (
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={isRefetching ?? false} zIndex={9} />
          <ImageIngestionProvider
            ids={images
              .filter((image) => image.ingestion !== ImageIngestionStatus.Scanned)
              .map(({ id }) => id)}
          >
            <ImagesProvider images={images}>
              <MasonryColumns
                data={images}
                imageDimensions={(data) => {
                  const width = data?.width ?? 450;
                  const height = data?.height ?? 450;
                  return { width, height };
                }}
                maxItemHeight={600}
                render={MasonryItem ?? ImagesCard}
                itemId={(data) => data.id}
              />
            </ImagesProvider>
          </ImageIngestionProvider>
          {hasNextPage && !isLoading && !isRefetching && (
            <Center ref={ref} sx={{ height: 36 }} mt="md">
              {inView && <Loader />}
            </Center>
          )}
          {!hasNextPage && showEof && <EndOfFeed />}
        </div>
      ) : (
        <Stack align="center" py="lg">
          <ThemeIcon size={128} radius={100}>
            <IconCloudOff size={80} />
          </ThemeIcon>
          <Text size={32} align="center">
            No results found
          </Text>
          <Text align="center">
            {"Try adjusting your search or filters to find what you're looking for"}
          </Text>
        </Stack>
      )}
    </IsClient>
  );
}
