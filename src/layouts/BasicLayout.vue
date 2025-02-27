<script lang="ts" setup>
import {
  IconMore,
  IconSearch,
  IconUserSettings,
  VTag,
  VAvatar,
  VSpace,
  VButton,
  Dialog,
} from "@halo-dev/components";
import { RoutesMenu } from "@/components/menu/RoutesMenu";
import type { MenuGroupType, MenuItemType } from "@halo-dev/console-shared";
import IconLogo from "~icons/core/logo?width=5rem&height=2rem";
import {
  RouterView,
  useRoute,
  useRouter,
  type RouteRecordRaw,
} from "vue-router";
import { computed, onMounted, onUnmounted, ref } from "vue";
import axios from "axios";
import GlobalSearchModal from "@/components/global-search/GlobalSearchModal.vue";
import LoginModal from "@/components/login/LoginModal.vue";
import { coreMenuGroups } from "@/router/routes.config";
import sortBy from "lodash.sortby";
import { useRoleStore } from "@/stores/role";
import { hasPermission } from "@/utils/permission";
import { useUserStore } from "@/stores/user";

const route = useRoute();
const router = useRouter();

const moreMenuVisible = ref(false);
const moreMenuRootVisible = ref(false);

const userStore = useUserStore();

const handleLogout = () => {
  Dialog.warning({
    title: "确定要退出登录吗？",
    onConfirm: async () => {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/logout`, undefined, {
          withCredentials: true,
        });

        await userStore.fetchCurrentUser();

        router.replace({ name: "Login" });
      } catch (error) {
        console.error("Failed to logout", error);
      }
    },
  });
};

const currentRole = computed(() => {
  return JSON.parse(
    userStore.currentUser?.metadata.annotations?.[
      "rbac.authorization.halo.run/role-names"
    ] || "[]"
  )[0];
});

// Global Search
const globalSearchVisible = ref(false);

const isMac = /macintosh|mac os x/i.test(navigator.userAgent);

const handleGlobalSearchKeybinding = (e: KeyboardEvent) => {
  const { key, ctrlKey, metaKey } = e;
  if (key === "k" && ((ctrlKey && !isMac) || metaKey)) {
    globalSearchVisible.value = true;
    e.preventDefault();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleGlobalSearchKeybinding);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalSearchKeybinding);
});

// Generate menus by routes
const menus = ref<MenuGroupType[]>([] as MenuGroupType[]);
const minimenus = ref<MenuItemType[]>([] as MenuItemType[]);

const roleStore = useRoleStore();
const { uiPermissions } = roleStore.permissions;

const generateMenus = () => {
  // sort by menu.priority and meta.core
  const currentRoutes = sortBy(
    router.getRoutes().filter((route) => {
      const { meta } = route;
      if (!meta?.menu) {
        return false;
      }
      if (meta.permissions) {
        return hasPermission(uiPermissions, meta.permissions as string[], true);
      }
      return true;
    }),
    [
      (route: RouteRecordRaw) => !route.meta?.core,
      (route: RouteRecordRaw) => route.meta?.menu?.priority || 0,
    ]
  );

  // group by menu.group
  menus.value = currentRoutes.reduce((acc, route) => {
    const { menu } = route.meta;
    if (!menu) {
      return acc;
    }
    const group = acc.find((item) => item.id === menu.group);
    const childRoute = route.children[0];
    const childMetaMenu = childRoute?.meta?.menu;

    // only support one level
    const menuChildren = childMetaMenu
      ? [
          {
            name: childMetaMenu.name,
            path: childRoute.path,
            icon: childMetaMenu.icon,
          },
        ]
      : undefined;
    if (group) {
      group.items?.push({
        name: menu.name,
        path: route.path,
        icon: menu.icon,
        mobile: menu.mobile,
        children: menuChildren,
      });
    } else {
      const menuGroup = coreMenuGroups.find((item) => item.id === menu.group);
      let name = "";
      if (!menuGroup) {
        name = menu.group;
      } else if (menuGroup.name) {
        name = menuGroup.name;
      }
      acc.push({
        id: menuGroup?.id || menu.group,
        name: name,
        priority: menuGroup?.priority || 0,
        items: [
          {
            name: menu.name,
            path: route.path,
            icon: menu.icon,
            mobile: menu.mobile,
            children: menuChildren,
          },
        ],
      });
    }
    return acc;
  }, [] as MenuGroupType[]);

  // sort by menu.priority
  menus.value = sortBy(menus.value, [
    (menu: MenuGroupType) => {
      return coreMenuGroups.findIndex((item) => item.id === menu.id) < 0;
    },
    (menu: MenuGroupType) => menu.priority || 0,
  ]);

  minimenus.value = menus.value
    .reduce((acc, group) => {
      if (group?.items) {
        acc.push(...group.items);
      }
      return acc;
    }, [] as MenuItemType[])
    .filter((item) => item.mobile);
};

onMounted(generateMenus);
</script>

<template>
  <div class="flex h-full">
    <aside class="navbar fixed hidden h-full overflow-y-auto md:block">
      <div class="logo flex justify-center pt-5 pb-7">
        <a href="/" target="_blank" title="访问首页">
          <IconLogo
            class="cursor-pointer select-none transition-all hover:brightness-125"
          />
        </a>
      </div>
      <div class="px-3">
        <div
          class="flex cursor-pointer items-center rounded bg-gray-100 p-2 text-gray-400 transition-all hover:text-gray-900"
          @click="globalSearchVisible = true"
        >
          <span class="mr-3">
            <IconSearch />
          </span>
          <span class="flex-1 select-none text-base font-normal">搜索</span>
          <div class="text-sm">
            {{ `${isMac ? "⌘" : "Ctrl"}+K` }}
          </div>
        </div>
      </div>
      <RoutesMenu :menus="menus" />
      <div class="current-profile">
        <div v-if="userStore.currentUser?.spec.avatar" class="profile-avatar">
          <VAvatar
            :src="userStore.currentUser?.spec.avatar"
            :alt="userStore.currentUser?.spec.displayName"
            size="md"
            circle
          ></VAvatar>
        </div>
        <div class="profile-name">
          <div class="flex text-sm font-medium">
            {{ userStore.currentUser?.spec.displayName }}
          </div>
          <div class="flex">
            <VTag>
              <template #leftIcon>
                <IconUserSettings />
              </template>
              {{ currentRole }}
            </VTag>
          </div>
        </div>
        <FloatingDropdown
          class="profile-control cursor-pointer rounded p-1 transition-all hover:bg-gray-100"
        >
          <IconMore />
          <template #popper>
            <div class="w-48 p-2">
              <VSpace class="w-full" direction="column">
                <VButton
                  v-close-popper
                  block
                  type="secondary"
                  :route="{
                    name: 'UserDetail',
                    params: { name: '-' },
                  }"
                >
                  个人资料
                </VButton>
                <VButton
                  v-close-popper
                  block
                  type="default"
                  @click="handleLogout"
                >
                  退出登录
                </VButton>
              </VSpace>
            </div>
          </template>
        </FloatingDropdown>
      </div>
    </aside>

    <main class="content w-full overflow-y-auto pb-12 mb-safe md:pb-0">
      <slot v-if="$slots.default" />
      <RouterView v-else />
    </main>

    <!--bottom nav bar-->
    <div
      v-if="minimenus"
      class="bottom-nav-bar fixed left-0 bottom-0 right-0 grid grid-cols-6 border-t-2 border-black bg-secondary drop-shadow-2xl mt-safe pb-safe md:hidden"
    >
      <div
        v-for="(menu, index) in minimenus"
        :key="index"
        :class="{ 'bg-black': route.path === menu?.path }"
        class="nav-item"
        @click="router.push(menu?.path)"
      >
        <div
          class="flex w-full cursor-pointer items-center justify-center p-1 text-white"
        >
          <div
            class="is-active is-active0 flex h-10 w-10 flex-col items-center justify-center"
          >
            <div class="text-base">
              <Component :is="menu?.icon" />
            </div>
            <div class="mt-0.5 text-xs">
              {{ menu?.name }}
            </div>
          </div>
        </div>
      </div>
      <div class="nav-item" @click="moreMenuVisible = true">
        <div
          class="flex w-full cursor-pointer items-center justify-center p-1 text-white"
        >
          <div
            class="is-active is-active0 flex h-10 w-10 flex-col items-center justify-center"
          >
            <div class="text-base">
              <IconMore />
            </div>
            <div class="mt-0.5 text-xs">更多</div>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-show="moreMenuRootVisible"
          class="drawer-wrapper fixed top-0 left-0 z-[99999] flex h-full w-full flex-row items-end justify-center"
        >
          <transition
            enter-active-class="ease-out duration-200"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="ease-in duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            @before-enter="moreMenuRootVisible = true"
            @after-leave="moreMenuRootVisible = false"
          >
            <div
              v-show="moreMenuVisible"
              class="drawer-layer absolute top-0 left-0 h-full w-full flex-none bg-gray-500 bg-opacity-75 transition-opacity"
              @click="moreMenuVisible = false"
            ></div>
          </transition>
          <transition
            enter-active-class="transform transition ease-in-out duration-500 sm:duration-700"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transform transition ease-in-out duration-500 sm:duration-700"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
          >
            <div
              v-show="moreMenuVisible"
              class="drawer-content relative flex h-3/4 w-screen flex-col items-stretch overflow-y-auto rounded-t-md bg-white shadow-xl"
            >
              <div class="drawer-body">
                <RoutesMenu
                  :menus="menus"
                  class="p-0"
                  @select="moreMenuVisible = false"
                />
              </div>
            </div>
          </transition>
        </div>
      </Teleport>
    </div>
  </div>
  <GlobalSearchModal v-model:visible="globalSearchVisible" />
  <LoginModal />
</template>

<style lang="scss">
.navbar {
  @apply w-64;
  @apply bg-white;
  z-index: 999;
  box-shadow: 0 4px 4px #f6c6ce;
  padding-bottom: 70px;

  .current-profile {
    height: 70px;
    @apply fixed
    left-0
    bottom-0
    flex
    w-64
    gap-3
    bg-white
    p-3;

    .profile-avatar {
      @apply flex
      items-center 
      self-center;
    }

    .profile-name {
      @apply flex-1
      self-center;
    }

    .profile-control {
      @apply self-center;
    }
  }
}

.content {
  @apply ml-0
  flex
  flex-auto
  flex-col
  overflow-x-hidden
  md:ml-64;
}
</style>
