import { AddCircleOutline as AddIcon, ArrowBack, Edit as EditIcon, LocalOffer } from "@mui/icons-material/";
import {
  Button,
  Chip,
  Skeleton,
  Tooltip,
  Typography,
  Box,
  useMediaQuery,
} from "@mui/material/";
import { useTheme } from "theme/useTheme";
import { BoldTypography } from "styles/AppStyles";
import ScrollToTopFab from "components/ScrollToTopFab/ScrollToTopFab";
import useBrowserTitle from "hooks/useBrowserTitle";
import useFilterViewCards from "hooks/useFilterViewCards";
import useSortViewCards from "hooks/useSortViewCards";
import { SortDirection, Studyset } from "shared/types";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetAllStudysets,
  useGetStudyset,
  useUpdateStudyset,
} from "state/api/studysetsAPI";
import { useGetUser } from "state/api/usersAPI";
import {
  DEFAULT_CATEGORIES,
  SORT_DIRECTIONS,
  VIEW_SET_DIALOGS,
  DEFAULT_USER_RESPONSE,
  NOTES_DRAWER_INITIAL_APPEARANCE,
  VIEWSET_LAYOUTS,
} from "shared/constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import DownloadSetModal from "./DownloadSetModal/DownloadSetModal";
import ManageCategoriesDialog from "./ManageCategoriesDialog/ManageCategoriesDialog";
import NotificationsDialog from "./NotificationsDialog/NotificationsDialog";
import PrintDialog from "./PrintDialog.tsx/PrintDialog";
import StudysetActions from "./StudysetActions/StudysetActions";
import StudysetSettings from "./StudysetSettings/StudysetSettings";
import ViewStudySetCard from "./ViewStudySetCard";
import ViewStudySetCardGrid from "./ViewStudySetCardGrid";
import ViewStudysetFilters from "./ViewStudysetFilters/ViewStudysetFilters";
import StudyModesGrid from "./StudyModesGrid/StudyModesGrid";
import {
  NoCardsMessage,
  ViewCardsGridContainer,
  StudyModesSection,
  StudysetDescription,
  StudysetInfo,
  UpdateCardsButton,
  ViewFlashsetPaper,
  ViewStudysetContainer,
  ViewStudysetHeader,
  ViewStudysetPage,
} from "./styles";
import NotesDrawer from "./NotesDrawer/NotesDrawer";
import AIChatPanel from "./AIChatPanel/AIChatPanel";
import { useViewSetsStore } from "state/stores/viewSets";
import { useAIChatStore } from "state/stores/aiChat";
import { useGlobalStore } from "state/stores/global";

type Props = {};

const ViewStudySet = (props: Props) => {
  /* Hooks / Redux */
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: studysetUUID = "" } = useParams();
  const { muiTheme } = useTheme();
  // The notes panel only reserves layout space (rather than overlaying) once
  // the screen is wide enough for the permanent side panel.
  const isWideScreen = useMediaQuery(muiTheme.breakpoints.up("lg"));

  const { setLabelsDialogProps } = useGlobalStore();
  const { selectedDialog, setSelectedDialog } = useViewSetsStore();

  const { data: userData = DEFAULT_USER_RESPONSE } = useGetUser();
  const { labels = [], userUUID = "" } = userData.user ?? {};

  /* Skip option prevents hook from running when userUUID is undefined */
  const { data: studysetsResponse, isLoading: isGetAllStudysetsLoading } =
    useGetAllStudysets();
  const studysets = studysetsResponse?.studysets ?? [];

  // Always refetch on mount so the lastViewed gate below never trusts a cached
  // copy of a set that has since been deleted.
  const {
    data: studysetResponse,
    isLoading: isStudySetLoading,
    isSuccess: isStudySetSuccess,
    isFetchedAfterMount: isStudySetFetchedAfterMount,
  } = useGetStudyset({ studysetUUID }, { refetchOnMount: "always" });
  const selectedStudyset = studysetResponse?.studyset ?? ({} as Studyset);
  const isOwnedSetLoaded =
    isStudySetSuccess &&
    isStudySetFetchedAfterMount &&
    studysetResponse?.studyset?.studysetUUID === studysetUUID;

  const { mutate: updateStudySet } = useUpdateStudyset();

  useBrowserTitle(selectedStudyset?.title ?? "");

  const lastViewedRecordedFor = useRef<string | null>(null);
  const studyModeIconStyle = {
    fontSize: "5rem",
  };

  const [selectedStudyMode, setSelectedStudyMode] = useState("");

  const [selectedTab, setSelectedTab] = useState(DEFAULT_CATEGORIES.ALL);
  const [selectedSort, setSelectedSort] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    SORT_DIRECTIONS.ASC,
  );
  const [isNotesDrawerHidden, setIsNotesDrawerHidden] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<string>(
    selectedStudyset?.metadata?.viewSetLayout ?? VIEWSET_LAYOUTS.LIST,
  );

  // The owner fetch only returns sets in the caller's library; an update for
  // any other id upserts an empty stub into it (#127).
  useEffect(() => {
    if (!studysetUUID || !isOwnedSetLoaded) return;
    if (lastViewedRecordedFor.current === studysetUUID) return;
    updateStudySet({
      studysetUUID,
      updates: { lastViewed: new Date().toISOString() },
    });
    lastViewedRecordedFor.current = studysetUUID;
  }, [studysetUUID, isOwnedSetLoaded]);

  // Sync drawer initial state from metadata. On narrow screens the drawer is a
  // temporary overlay, so keep it closed on load instead of covering the page.
  useEffect(() => {
    if (selectedStudyset?.metadata?.notesDrawerInitial) {
      const shouldBeHidden =
        selectedStudyset.metadata.notesDrawerInitial ===
        NOTES_DRAWER_INITIAL_APPEARANCE.CLOSED;
      setIsNotesDrawerHidden(isWideScreen ? shouldBeHidden : true);
    }
  }, [selectedStudyset?.metadata?.notesDrawerInitial, isWideScreen]);

  // Sync view mode from metadata
  useEffect(() => {
    if (selectedStudyset?.metadata?.viewSetLayout) {
      setViewMode(selectedStudyset.metadata.viewSetLayout);
    }
  }, [selectedStudyset?.metadata?.viewSetLayout]);

  // Persist view mode to metadata
  useEffect(() => {
    if (
      viewMode &&
      isOwnedSetLoaded &&
      selectedStudyset?.metadata?.viewSetLayout !== viewMode
    ) {
      updateMetadataField("viewSetLayout", viewMode);
    }
  }, [viewMode]);

  const updateMetadataField = (property: string, newValue: any) => {
    try {
      updateStudySet({
        studysetUUID,
        updates: {
          [property]: newValue,
        },
        isMetadataUpdate: true,
      });
    } catch (error) {
      console.error("Error updating study set metadata");
    }
  };

  const handleBackClick = () => {
    navigate("/");
  };

  const sortedViewFlashCards = useSortViewCards({
    selectedSort,
    sortDirection,
    studyset: selectedStudyset,
  });

  const filteredViewFlashCards = useFilterViewCards({
    selectedTab,
    sortedViewFlashCards,
  });

  /* #region Drag and Drop */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const cards = selectedStudyset.cards ?? [];
      const oldIndex = cards.findIndex((item) => item.cardUUID === active.id);
      const newIndex = cards.findIndex((item) => item.cardUUID === over.id);

      const reorderedCards = arrayMove(cards, oldIndex, newIndex);

      updateStudySet({
        studysetUUID,
        updates: {
          cards: reorderedCards,
        },
      });
    }
  };
  // #endregion

  const showManageLabelsDialog = () => {
    setLabelsDialogProps({
      open: true,
      studysetUUID: selectedStudyset.studysetUUID ?? "",
    });
  };

  const onDialogClose = () => {
    setSelectedDialog("");
  };

  const handleUpdateCards = () => {
    navigate(`/edit/${studysetUUID}`);
  };

  const notesDrawerPosition =
    selectedStudyset?.metadata?.notesDrawerPosition || "right";
  // The AI panel docks on the opposite side from the notes drawer.
  const aiPanelPosition = notesDrawerPosition === "right" ? "left" : "right";
  const { isOpen: isAIPanelOpen } = useAIChatStore();
  // Below `lg` the drawer is a temporary overlay, so it reserves no space and
  // we fall back to the page's own responsive padding (undefined = inherit).
  const drawerOpenPadding = { xs: undefined, lg: "27.5rem" };
  const drawerClosedPadding = { xs: undefined, sm: "3rem", lg: "4rem" };
  const basePadding = { xs: undefined, lg: "2rem" };

  const getPadding = () => {
    let paddingLeft = isNotesDrawerHidden
      ? drawerClosedPadding
      : notesDrawerPosition === "left"
        ? drawerOpenPadding
        : basePadding;
    let paddingRight = isNotesDrawerHidden
      ? drawerClosedPadding
      : notesDrawerPosition === "right"
        ? drawerOpenPadding
        : basePadding;

    // Reserve space for the AI panel on its docked side when open.
    if (isAIPanelOpen) {
      if (aiPanelPosition === "left") paddingLeft = drawerOpenPadding;
      else paddingRight = drawerOpenPadding;
    }

    return { paddingLeft, paddingRight };
  };

  const padding = getPadding();

  return (
    <>
      <ViewStudysetPage
        className="view-set-page"
        viewMode={viewMode as "list" | "grid"}
        sx={{
          ...padding,
        }}
      >
        <ViewFlashsetPaper elevation={6}>
          <ViewStudysetContainer>
            <ViewStudysetHeader id="viewStudysetHeader">
              <StudysetInfo>
                <Button
                  onClick={handleBackClick}
                  startIcon={<ArrowBack color="primary" />}
                >
                  {t("viewStudySet.backToStudySets")}
                </Button>
                <BoldTypography 
                  variant="h5" 
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isStudySetLoading ? (
                    <Skeleton />
                  ) : (
                    <>{selectedStudyset?.title}</>
                  )}
                </BoldTypography>
                <Typography variant="subtitle1">
                  {isStudySetLoading ? (
                    <Skeleton />
                  ) : (
                    <>
                      {t("viewStudySet.createdBy", {
                        username: selectedStudyset?.username,
                      })}
                    </>
                  )}
                </Typography>
                <StudysetDescription variant="body1">
                  {isStudySetLoading ? (
                    <Skeleton />
                  ) : (
                    <>{selectedStudyset?.description}</>
                  )}
                </StudysetDescription>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    mt: "1rem",
                    mb: "1rem",
                  }}
                >
                  <Tooltip
                    title={t("viewStudySet.manageLabels")}
                    placement="right"
                  >
                    <LocalOffer
                      sx={{
                        fontSize: "1.25rem",
                        color: "primary.main",
                        cursor: "pointer",
                        "&:hover": {
                          opacity: 0.7,
                        },
                      }}
                      onClick={showManageLabelsDialog}
                    />
                  </Tooltip>
                  {selectedStudyset?.labels?.length > 0 ? (
                    selectedStudyset.labels.map((label, index) => (
                      <Chip key={index} label={label} variant="outlined" />
                    ))
                  ) : (
                    <Chip
                      label={t("viewStudySet.noLabelsSelected")}
                      color="error"
                      variant="outlined"
                    />
                  )}
                </Box>
                <StudysetActions
                  updateMetadataField={updateMetadataField}
                  selectedStudyset={selectedStudyset}
                />
              </StudysetInfo>
              <StudyModesSection>
                <StudyModesGrid
                  studysetUUID={studysetUUID}
                  cardCount={selectedStudyset?.cards?.length ?? 0}
                />
              </StudyModesSection>
            </ViewStudysetHeader>
          </ViewStudysetContainer>
        </ViewFlashsetPaper>
        <ViewStudysetFilters
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          selectedSort={selectedSort}
          setSelectedSort={setSelectedSort}
          selectedStudyset={selectedStudyset}
          setSortDirection={setSortDirection}
          sortDirection={sortDirection}
          viewMode={viewMode}
          setViewMode={setViewMode}
          cardCount={selectedStudyset?.cards?.length ?? 0}
          cardCountVisible={selectedStudyset?.metadata?.cardCountVisible}
        />
        {/* Testing out virtual scrolling */}
        {/* <Virtuoso
                style={{
                    height: "20rem",
                }}
                totalCount={filteredViewFlashCards.length}
            /> */}
        {filteredViewFlashCards.length === 0 &&
        selectedTab !== DEFAULT_CATEGORIES.ALL ? (
          <NoCardsMessage>{t("viewStudySet.noCardsCategory")}</NoCardsMessage>
        ) : filteredViewFlashCards.length === 0 ? (
          <NoCardsMessage>{t("viewStudySet.noCardsInSet")}</NoCardsMessage>
        ) : viewMode === VIEWSET_LAYOUTS.GRID ? (
          <ViewCardsGridContainer>
            {filteredViewFlashCards.map((card, index) => (
              <ViewStudySetCardGrid
                key={card.cardUUID}
                card={card}
                index={index}
                selectedStudyset={selectedStudyset}
              />
            ))}
          </ViewCardsGridContainer>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredViewFlashCards.map((card) => card.cardUUID)}
              strategy={verticalListSortingStrategy}
            >
              {filteredViewFlashCards.map((card, index) => {
                const { cardUUID } = card;
                return (
                  <ViewStudySetCard
                    key={cardUUID}
                    card={card}
                    index={index}
                    selectedStudyset={selectedStudyset}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
        <UpdateCardsButton
          variant="contained"
          onClick={handleUpdateCards}
          startIcon={
            selectedStudyset?.cards?.length === 0 ? (
              <AddIcon sx={{ fontSize: "1.5rem" }} />
            ) : (
              <EditIcon sx={{ fontSize: "1.5rem" }} />
            )
          }
        >
          {selectedStudyset?.cards?.length === 0
            ? t("viewStudySet.addCards")
            : t("viewStudySet.updateCards")}
        </UpdateCardsButton>
        <NotesDrawer
          selectedStudyset={selectedStudyset}
          isHidden={isNotesDrawerHidden}
          onToggle={setIsNotesDrawerHidden}
        />
        <AIChatPanel
          selectedStudyset={selectedStudyset}
          notesDrawerPosition={notesDrawerPosition as "left" | "right"}
        />
      </ViewStudysetPage>
      <NotificationsDialog
        open={selectedDialog === VIEW_SET_DIALOGS.NOTIFICATIONS}
        onClose={onDialogClose}
        studysetUUID={studysetUUID}
        studysetTitle={selectedStudyset?.title}
      />
      <DownloadSetModal
        open={selectedDialog === VIEW_SET_DIALOGS.DOWNLOAD}
        onClose={onDialogClose}
        studyset={selectedStudyset}
      />
      <ManageCategoriesDialog
        open={selectedDialog === VIEW_SET_DIALOGS.CATEGORIES}
        onClose={onDialogClose}
        selectedStudyset={selectedStudyset}
        studysets={studysets}
      />
      <StudysetSettings
        open={selectedDialog === VIEW_SET_DIALOGS.SETTINGS}
        onClose={onDialogClose}
        studyset={selectedStudyset}
      />
      <PrintDialog
        open={selectedDialog === VIEW_SET_DIALOGS.PRINT}
        onClose={onDialogClose}
        studyset={selectedStudyset}
      />
      <ScrollToTopFab />
    </>
  );
};

export default ViewStudySet;
