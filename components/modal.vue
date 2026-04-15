<script setup lang="ts">
const open = defineModel<boolean>('open', { required: false })

interface ModalProps {
    title?: string;
    description?: string;

    modalClass?: string;
    contentClass?: string;
}

const props = withDefaults(defineProps<ModalProps>(), {
    modalClass: 'max-w-xl',
});

const emits = defineEmits<{
    'update:open': [value: boolean];
}>();

const onClose = () => {
    open.value = false;
};
</script>

<template>
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/25" @click.self="onClose">
        <div :class="['w-full max-h-[calc(100vh-100px)] flex flex-col gap-y-8 rounded-xl shadow-lg bg-white', props.modalClass]"
            @click.stop>
            <section id="header" class="relative pt-6 px-6 flex flex-col justify-center">
                <p v-show="!props.title" class="text-center text-lg md:text-xl lg:text-2xl text-[#4E6AFF] font-bold select-none">{{ props.title }}</p>
                <button type="button" class="absolute top-0 right-3 text-2xl text-gray-400 hover:text-[#0a0c16]"
                    @click.prevent="onClose">×
                </button>
            </section>

            <section id="content">
                <slot></slot>
            </section>
        </div>
    </div>
</template>

<style scoped></style>