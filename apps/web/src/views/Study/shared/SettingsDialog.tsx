import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import { Settings as SettingsIcon } from "@mui/icons-material";
import { StudySessionSettings } from "shared/types";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  settings: StudySessionSettings;
  onClose: () => void;
  onSave: (settings: StudySessionSettings) => void;
};

const SettingsDialog = ({ open, settings, onClose, onSave }: Props) => {
  const { t } = useTranslation("study");
  const difficultyLabels: Record<"easy" | "medium" | "hard", string> = {
    easy: t("settings.difficultyEasy"),
    medium: t("settings.difficultyMedium"),
    hard: t("settings.difficultyHard"),
  };
  const [localSettings, setLocalSettings] =
    useState<StudySessionSettings>(settings);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  const handleSwitchChange = (field: keyof StudySessionSettings) => {
    setLocalSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    setLocalSettings((prev) => ({
      ...prev,
      timePerCard: value as number,
    }));
  };

  const handleDifficultyChange = (difficulty: "easy" | "medium" | "hard") => {
    setLocalSettings((prev) => ({
      ...prev,
      difficulty,
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "1rem",
          padding: "1rem",
        },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <SettingsIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t("settings.title")}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            py: "1rem",
          }}
        >
          {/* Card Settings */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: "1rem" }}
            >
              {t("settings.cardSection")}
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.shuffleCards}
                    onChange={() => handleSwitchChange("shuffleCards")}
                    color="primary"
                  />
                }
                label={t("settings.shuffleCards")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.autoAdvance}
                    onChange={() => handleSwitchChange("autoAdvance")}
                    color="primary"
                  />
                }
                label={t("settings.autoAdvance")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.hideImages}
                    onChange={() => handleSwitchChange("hideImages")}
                    color="primary"
                  />
                }
                label={t("settings.hideImages")}
              />
            </Box>
          </Box>

          <Divider />

          {/* Audio Settings */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: "1rem" }}
            >
              {t("settings.audioSection")}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={localSettings.audioEnabled}
                  onChange={() => handleSwitchChange("audioEnabled")}
                  color="primary"
                />
              }
              label={t("settings.tts")}
            />
          </Box>

          <Divider />

          {/* Timer Settings */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: "1rem" }}
            >
              {t("settings.timerSection")}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={localSettings.timedMode}
                  onChange={() => handleSwitchChange("timedMode")}
                  color="primary"
                />
              }
              label={t("settings.timedMode")}
            />

            {localSettings.timedMode && (
              <Box sx={{ mt: "1.5rem", px: "0.5rem" }}>
                <Typography variant="body2" gutterBottom>
                  {t("settings.timePerCard", {
                    seconds: localSettings.timePerCard || 30,
                  })}
                </Typography>
                <Slider
                  value={localSettings.timePerCard || 30}
                  onChange={handleSliderChange}
                  min={10}
                  max={120}
                  step={5}
                  marks={[
                    { value: 10, label: "10s" },
                    { value: 30, label: "30s" },
                    { value: 60, label: "60s" },
                    { value: 120, label: "120s" },
                  ]}
                  valueLabelDisplay="auto"
                  sx={{
                    "& .MuiSlider-markLabel": {
                      fontSize: "0.75rem",
                    },
                  }}
                />
              </Box>
            )}
          </Box>

          <Divider />

          {/* Difficulty Settings */}
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: "1rem" }}
            >
              {t("settings.difficultySection")}
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: "0.5rem",
              }}
            >
              {(["easy", "medium", "hard"] as const).map((difficulty) => (
                <Button
                  key={difficulty}
                  variant={
                    localSettings.difficulty === difficulty
                      ? "contained"
                      : "outlined"
                  }
                  onClick={() => handleDifficultyChange(difficulty)}
                  sx={{
                    flex: 1,
                    textTransform: "capitalize",
                  }}
                >
                  {difficultyLabels[difficulty]}
                </Button>
              ))}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: "0.5rem" }}
            >
              {localSettings.difficulty === "easy" &&
                t("settings.difficultyEasyDesc")}
              {localSettings.difficulty === "medium" &&
                t("settings.difficultyMediumDesc")}
              {localSettings.difficulty === "hard" &&
                t("settings.difficultyHardDesc")}
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: "1.5rem", pb: "1rem" }}>
        <Button onClick={handleCancel} variant="outlined">
          {t("settings.cancel")}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("settings.saveSettings")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog;
