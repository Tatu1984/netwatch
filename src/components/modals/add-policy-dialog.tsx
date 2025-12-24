"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/stores/ui";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["WEBSITE", "APPLICATION", "KEYWORD"]),
  pattern: z.string().min(1, "Pattern is required"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddPolicyDialog() {
  const { activeModal, closeModal } = useUIStore();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "WEBSITE",
      pattern: "",
      isActive: true,
    },
  });

  const selectedType = form.watch("type");

  const getPatternPlaceholder = () => {
    switch (selectedType) {
      case "WEBSITE":
        return "*.facebook.com, *.twitter.com";
      case "APPLICATION":
        return "chrome.exe, firefox.exe";
      case "KEYWORD":
        return "job search, resume";
      default:
        return "";
    }
  };

  const getPatternDescription = () => {
    switch (selectedType) {
      case "WEBSITE":
        return "Use wildcards (*) to match domains. Separate multiple patterns with commas.";
      case "APPLICATION":
        return "Enter application executable names to block.";
      case "KEYWORD":
        return "Enter keywords to flag in activity. Separate multiple keywords with commas.";
      default:
        return "";
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create policy");
      }

      closeModal();
      form.reset();
    } catch (error) {
      console.error("Error creating policy:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={activeModal === "add-policy"}
      onOpenChange={(open) => !open && closeModal()}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Policy</DialogTitle>
          <DialogDescription>
            Create a blocking or monitoring policy for your organization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Block Social Media" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="WEBSITE">Website Block</SelectItem>
                      <SelectItem value="APPLICATION">Application Block</SelectItem>
                      <SelectItem value="KEYWORD">Keyword Flag</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pattern</FormLabel>
                  <FormControl>
                    <Input placeholder={getPatternPlaceholder()} {...field} />
                  </FormControl>
                  <FormDescription>{getPatternDescription()}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable this policy immediately after creation.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Policy
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
