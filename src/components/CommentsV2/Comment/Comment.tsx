import {
  GroupProps,
  Group,
  ActionIcon,
  Menu,
  Stack,
  Text,
  Button,
  Box,
  createStyles,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useCommentsContext } from '../CommentsProvider';
import { CreateComment } from './CreateComment';
import { CommentForm } from './CommentForm';
import { InfiniteCommentResults } from '~/server/controllers/commentv2.controller';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { IconDotsVertical, IconTrash, IconEdit, IconFlag, IconArrowBackUp } from '@tabler/icons';
import { DaysFromNow } from '~/components/Dates/DaysFromNow';
import { RenderHtml } from '~/components/RenderHtml/RenderHtml';
import { openContext } from '~/providers/CustomModalsProvider';
import { ReportEntity } from '~/server/schema/report.schema';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import { create } from 'zustand';
import React from 'react';
import { CommentReactions } from './CommentReactions';
import { DeleteComment } from './DeleteComment';
import { CommentProvider, useCommentV2Context } from './CommentProvider';
import { CommentBadge } from '~/components/CommentsV2/Comment/CommentBadge';
import { useRouter } from 'next/router';

type Store = {
  id?: number;
  setId: (id?: number) => void;
};

const useStore = create<Store>((set) => ({
  setId: (id) => set(() => ({ id })),
}));

type CommentProps = Omit<GroupProps, 'children'> & {
  comment: InfiniteCommentResults['comments'][0];
};

export function Comment({ comment, ...groupProps }: CommentProps) {
  return (
    <CommentProvider comment={comment}>
      <CommentContent comment={comment} {...groupProps} />
    </CommentProvider>
  );
}

export function CommentContent({ comment, ...groupProps }: CommentProps) {
  const { entityId, entityType } = useCommentsContext();
  const { canDelete, canEdit, canReply, badge, canReport } = useCommentV2Context();
  const { query } = useRouter();
  const { classes } = useStyles();

  const id = useStore((state) => state.id);
  const setId = useStore((state) => state.setId);

  const editing = id === comment.id;
  const [replying, setReplying] = useState(false);
  const highlighted = query.highlight && query.highlight === comment.id.toString();

  useEffect(() => {
    if (!highlighted) return;
    const elem = document.getElementById(`comment-${comment.id}`);
    if (elem) elem.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
  }, [highlighted]);

  return (
    <Group
      id={`comment-${comment.id}`}
      align="flex-start"
      noWrap
      {...groupProps}
      spacing="sm"
      className={highlighted ? classes.highlightedComment : undefined}
    >
      <UserAvatar user={comment.user} size="md" linkToProfile />
      <Stack spacing={0} style={{ flex: 1 }}>
        <Group position="apart">
          {/* AVATAR */}
          <Group spacing={8} align="center">
            <UserAvatar
              user={comment.user}
              size="md"
              linkToProfile
              includeAvatar={false}
              withUsername
              badge={badge ? <CommentBadge {...badge} /> : null}
            />
            <Text color="dimmed" size="xs" mt={2}>
              <DaysFromNow date={comment.createdAt} />
            </Text>
          </Group>

          {/* CONTROLS */}
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon size="xs" variant="subtle">
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {canDelete && (
                <>
                  <DeleteComment id={comment.id} entityId={entityId} entityType={entityType}>
                    {({ onClick }) => (
                      <Menu.Item
                        icon={<IconTrash size={14} stroke={1.5} />}
                        color="red"
                        onClick={onClick}
                      >
                        Delete comment
                      </Menu.Item>
                    )}
                  </DeleteComment>
                  {canEdit && (
                    <Menu.Item
                      icon={<IconEdit size={14} stroke={1.5} />}
                      onClick={() => setId(comment.id)}
                    >
                      Edit comment
                    </Menu.Item>
                  )}
                </>
              )}
              {canReport && (
                <LoginRedirect reason="report-model">
                  <Menu.Item
                    icon={<IconFlag size={14} stroke={1.5} />}
                    onClick={() =>
                      openContext('report', {
                        entityType: ReportEntity.CommentV2,
                        entityId: comment.id,
                      })
                    }
                  >
                    Report
                  </Menu.Item>
                </LoginRedirect>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
        {/* COMMENT / EDIT COMMENT */}
        <Stack style={{ flex: 1 }} spacing={4}>
          {!editing ? (
            <>
              <RenderHtml
                html={comment.content}
                sx={(theme) => ({ fontSize: theme.fontSizes.sm })}
              />
              {/* COMMENT INTERACTION */}
              <Group spacing={4}>
                <CommentReactions comment={comment} />
                {canReply && (
                  <Button
                    variant="subtle"
                    size="xs"
                    radius="xl"
                    onClick={() => setReplying(true)}
                    compact
                  >
                    <Group spacing={4}>
                      <IconArrowBackUp size={14} />
                      Reply
                    </Group>
                  </Button>
                )}
              </Group>
            </>
          ) : (
            <CommentForm comment={comment} onCancel={() => setId(undefined)} autoFocus />
          )}
        </Stack>
        {canReply && replying && (
          <Box pt="sm">
            <CreateComment autoFocus replyTo={comment.user} onCancel={() => setReplying(false)} />
          </Box>
        )}
      </Stack>
    </Group>
  );
}

const useStyles = createStyles((theme) => ({
  highlightedComment: {
    background: theme.fn.rgba(theme.colors.blue[5], 0.2),
    margin: `-${theme.spacing.xs}px`,
    padding: `${theme.spacing.xs}px`,
    borderRadius: theme.radius.sm,
  },
}));
